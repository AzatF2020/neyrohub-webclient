import { computed, ref } from 'vue';
import { apiErrorText } from '@/lib/api';
import * as chatsApi from '@/lib/chats';
import { MessageRole, TaskStatus, isPending, isTextGeneration } from '@/lib/neurals';
import { useChats } from './useChats';
import { useSocket } from './useSocket';

/** Сколько сообщений тянем за раз */
const PER_PAGE = 20;

/** Как часто перечитывать сообщения, когда сокет недоступен */
const POLL_INTERVAL = 6000;

/** Состояние одного открытого чата: создаётся экраном чата и живёт вместе с ним */
export function useChat() {
	const { isConnected, subscribe } = useSocket();
	const { setLastMessage } = useChats();

	const chat = ref(null);
	const messages = ref([]);
	const total = ref(0);
	/** Прогресс генерации по taskId — только из сокета, в БД его нет */
	const progress = ref({});
	/**
	 * Сообщения, которых ещё нет в БД: отправленный запрос показываем сразу, не дожидаясь
	 * ответа сервера. У генерации это одна запись с местом под результат, у переписки —
	 * пара реплик на время стрима. Форма как у настоящих записей: лента их не различает.
	 */
	const draft = ref([]);
	const isLoading = ref(false);
	const isLoadingMore = ref(false);
	const isSending = ref(false);
	const isStreaming = ref(false);
	const error = ref('');

	/** Лента для экрана: сохранённые сообщения плюс незавершённый обмен */
	const feed = computed(() =>
		draft.value.length ? [...messages.value, ...draft.value] : messages.value,
	);
	const hasPending = computed(() => messages.value.some((message) => isPending(message.status)));
	const hasMore = computed(() => messages.value.length < total.value);

	let page = 1;
	let unsubscribe = null;
	let timer = null;
	let controller = null;

	/** Лента идёт по возрастанию id, а бэкенд отдаёт страницы от свежих к старым */
	function merge(incoming) {
		const byId = new Map(messages.value.map((message) => [message.id, message]));

		for (const item of incoming) {
			byId.set(item.id, { ...byId.get(item.id), ...item });
		}
		messages.value = [...byId.values()].sort((a, b) => a.id - b.id);
	}

	async function loadPage(nextPage) {
		const { items, total: count } = await chatsApi.fetchMessages(chat.value.id, {
			page: nextPage,
			perPage: PER_PAGE,
		});
		total.value = count;

		return items;
	}

	/** Подгружает страницу постарше — их дорисовывает лента при прокрутке вверх */
	async function loadOlder() {
		if (!chat.value || isLoadingMore.value || !hasMore.value) return;

		isLoadingMore.value = true;
		try {
			merge(await loadPage(page + 1));
			page += 1;
		} finally {
			isLoadingMore.value = false;
		}
	}

	async function reload() {
		if (!chat.value) return;
		merge(await loadPage(1));
	}

	function applyStatus(event) {
		if (!chat.value) return;

		const message = messages.value.find((item) => item.taskId === event.taskId);

		// Сообщение могло появиться в другой вкладке — там его подхватит опрос
		if (!message) return;

		message.status = event.status;
		if (event.output !== undefined) message.output = event.output;
		if (event.errorReason) message.errorReason = event.errorReason;

		if (!isPending(event.status)) {
			const { [event.taskId]: _done, ...rest } = progress.value;
			progress.value = rest;
		}
		setLastMessage(chat.value.id, message);
	}

	function applyProgress(event) {
		progress.value = { ...progress.value, [event.taskId]: event.progress ?? 0 };
	}

	async function open(chatId) {
		close();
		isLoading.value = true;
		error.value = '';

		try {
			chat.value = await chatsApi.fetchChat(chatId);
			page = 1;
			merge(await loadPage(1));
		} finally {
			isLoading.value = false;
		}

		watchTasks();
	}

	/**
	 * Чат только что создан этим же экраном. Запись о нём у нас уже есть, а сообщений
	 * в нём заведомо нет — читать его с сервера незачем: два запроса впустую, и всё это
	 * время лента выглядит пустой, хотя запрос человек уже отправил.
	 */
	function adopt(created) {
		close();
		chat.value = created;
		page = 1;

		watchTasks();
	}

	/** Следим за задачами чата. У текстовых моделей их нет: ответ приходит стримом */
	function watchTasks() {
		if (isTextGeneration(chat.value.type)) return;

		unsubscribe = subscribe(chatsApi.chatRoom(chat.value.id), {
			'task.status': applyStatus,
			'task.progress': applyProgress,
		});

		// Страховка на случай, если сокет не поднялся: пока есть незавершённые задачи — перечитываем
		timer = setInterval(() => {
			if (isConnected.value || !hasPending.value) return;
			void reload();
		}, POLL_INTERVAL);
	}

	function close() {
		unsubscribe?.();
		unsubscribe = null;
		clearInterval(timer);
		timer = null;
		stop();

		chat.value = null;
		messages.value = [];
		total.value = 0;
		progress.value = {};
		draft.value = [];
		isStreaming.value = false;
		page = 1;
	}

	/** Обрывает стрим: бэкенд по закрытому соединению отменяет запрос к провайдеру */
	function stop() {
		controller?.abort();
		controller = null;
	}

	async function send(options) {
		if (!chat.value || isSending.value || isStreaming.value) return null;

		if (isTextGeneration(chat.value.type)) return stream(options);

		isSending.value = true;
		error.value = '';
		// Запись создаётся на бэкенде, но показать запрос надо сразу — ждать её незачем
		draft.value = [draftGeneration(options)];

		try {
			// Генерация — одна запись: запрос, задача и место под результат вместе
			const message = await chatsApi.sendMessage(chat.value.id, {
				type: chat.value.type,
				model: chat.value.model,
				options,
			});
			merge([message]);
			total.value += 1;
			setLastMessage(chat.value.id, message);

			return message;
		} catch (requestError) {
			error.value = apiErrorText(requestError) ?? '';
			throw requestError;
		} finally {
			// Настоящая запись уже в ленте: подменяем её черновик в том же кадре
			draft.value = [];
			isSending.value = false;
		}
	}

	/** Место запроса в ленте, пока его не подтвердил бэкенд: та же форма, что у записи генерации */
	function draftGeneration(options) {
		return {
			id: 'draft',
			input: options,
			status: TaskStatus.Created,
			output: null,
			createdAt: new Date().toISOString(),
		};
	}

	/**
	 * Текстовый ответ идёт потоком: черновик пары реплик показываем сразу и
	 * наполняем его кусками, а в конце подменяем настоящими записями из БД.
	 * Форма черновика — как у записей chat_messages, чтобы лента не различала их.
	 */
	async function stream(options) {
		const createdAt = new Date().toISOString();

		draft.value = [
			{
				id: 'draft-user',
				role: MessageRole.User,
				content: options.prompt ?? '',
				params: options,
				createdAt,
			},
			{
				id: 'draft-answer',
				role: MessageRole.Assistant,
				content: '',
				status: TaskStatus.Pending,
				createdAt,
			},
		];
		isStreaming.value = true;
		error.value = '';
		controller = new AbortController();

		try {
			return await chatsApi.streamMessage(
				chat.value.id,
				{ type: chat.value.type, model: chat.value.model, options },
				{
					signal: controller.signal,
					onDelta: (delta) => {
						draft.value[1].content += delta;
					},
				},
			);
		} catch (streamError) {
			// Остановили сами: бэкенд уже сохранил то, что модель успела написать
			if (chatsApi.isAborted(streamError)) return null;

			error.value = apiErrorText(streamError) ?? streamError.message ?? '';
			throw streamError;
		} finally {
			controller = null;
			// Записи создаются в начале стрима, поэтому свежая страница знает про обе
			await reload().catch(() => {});
			draft.value = [];
			isStreaming.value = false;

			// Экран могли закрыть на середине стрима — тогда обновлять уже нечего
			const last = messages.value.at(-1);
			if (chat.value && last) setLastMessage(chat.value.id, last);
		}
	}

	return {
		chat,
		messages,
		feed,
		progress,
		isLoading,
		isLoadingMore,
		isSending,
		isStreaming,
		error,
		hasPending,
		hasMore,
		open,
		adopt,
		close,
		loadOlder,
		send,
		stop,
	};
}
