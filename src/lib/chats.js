import { PUBLIC_API_BASE_URL } from 'astro:env/client';
import { api, redirectToLogin } from './api';

/**
 * Чаты одного раздела: тип генерации отбирает бэкенд, без него он отдал бы всё подряд.
 *
 * Превью карточки — последнее сообщение чата: по флагу last_message бэкенд отдаёт его
 * в поле `messages` массивом из одной записи. У пустого чата запись в нём null.
 */
export async function fetchChats({ type, page = 1, perPage = 30 } = {}) {
	const { data } = await api.get('/chats', {
		params: { type, page, per_page: perPage, last_message: true },
	});

	const items = (data.items ?? []).map(({ messages, ...chat }) => ({
		...chat,
		lastMessage: messages?.[0] ?? null,
	}));

	return { items, total: data.total ?? items.length };
}

export async function fetchChat(chatId) {
	const { data } = await api.get(`/chats/${chatId}`);
	return data;
}

export async function createChat({ type, model }) {
	const { data } = await api.post('/chats/create', { type, model });
	return data.chatId;
}

export async function deleteChat(chatId) {
	await api.delete(`/chats/delete/${chatId}`);
}

/**
 * Сообщения отдаются страницами от свежих к старым: первая страница — хвост ленты.
 * Возвращаем как есть, разворачивает их уже useChat.
 */
export async function fetchMessages(chatId, { page = 1, perPage = 20 } = {}) {
	const { data } = await api.get(`/chats/${chatId}/messages`, {
		params: { page, per_page: perPage },
	});
	const messages = data.messages ?? {};

	return { items: messages.items ?? [], total: messages.total ?? 0 };
}

/** Сообщение создаётся вместе с задачей генерации: в ответе уже есть taskId */
export async function sendMessage(chatId, { type, model, options }) {
	const { data } = await api.post(`/chats/${chatId}/messages/create`, { type, model, options });
	return data;
}

/**
 * Ответ текстовой модели приходит потоком SSE в том же запросе. Запрос — POST,
 * поэтому EventSource не подходит: тело ответа читаем сами. onDelta зовётся на
 * каждый кусок текста, возврат — данные события done: { messageId, text, usage }.
 */
export async function streamMessage(chatId, { type, model, options }, { onDelta, signal } = {}) {
	const response = await fetch(`${PUBLIC_API_BASE_URL}/chats/${chatId}/messages/stream`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
		body: JSON.stringify({ type, model, options }),
		signal,
	});

	if (!response.ok || !response.body) throw await requestError(response);

	let result = null;

	for await (const frame of readFrames(response.body)) {
		const payload = parseData(frame.data);
		if (!payload) continue;

		switch (payload.type ?? frame.event) {
			case 'delta':
				onDelta?.(payload.delta ?? '');
				break;

			case 'done':
				result = payload;
				break;

			// Ошибка приходит кадром: заголовки ответа ушли ещё до обращения к провайдеру
			case 'error':
				throw new Error(payload.message || '');
		}
	}

	return result;
}

/** Стрим оборвали своей кнопкой «Остановить» — для интерфейса это не ошибка */
export function isAborted(error) {
	return error?.name === 'AbortError';
}

/** Ошибку до начала потока Nest отдаёт обычным JSON — приводим её к виду ошибок axios */
async function requestError(response) {
	if (response.status === 401) redirectToLogin();

	const data = await response.json().catch(() => null);
	const error = new Error(`stream failed: ${response.status}`);
	error.response = { status: response.status, data };

	return error;
}

/**
 * Режет поток на SSE-события: кадры разделены пустой строкой, но границы сетевых
 * чанков с ними не совпадают, поэтому недобранный хвост ждёт следующего чанка.
 */
async function* readFrames(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			buffer = buffer.replace(/\r\n/g, '\n');

			let separator = buffer.indexOf('\n\n');

			while (separator !== -1) {
				const frame = parseFrame(buffer.slice(0, separator));
				buffer = buffer.slice(separator + 2);

				if (frame) yield frame;
				separator = buffer.indexOf('\n\n');
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
}

/** Кадр без data событием не считается: так выглядят пинги, которыми держат соединение */
function parseFrame(frame) {
	const data = [];
	let event = 'message';

	for (const line of frame.split('\n')) {
		if (!line || line.startsWith(':')) continue;

		const colon = line.indexOf(':');
		const field = colon === -1 ? line : line.slice(0, colon);
		const raw = colon === -1 ? '' : line.slice(colon + 1);
		const value = raw.startsWith(' ') ? raw.slice(1) : raw;

		if (field === 'data') data.push(value);
		else if (field === 'event') event = value;
	}

	return data.length ? { event, data: data.join('\n') } : null;
}

function parseData(data) {
	try {
		return JSON.parse(data);
	} catch {
		console.warn('[chat] нераспознанный кадр стрима:', data.slice(0, 200));
		return null;
	}
}

/** Комната socket.io, в которую бэкенд шлёт события задач этого чата */
export function chatRoom(chatId) {
	return `chat:${chatId}`;
}
