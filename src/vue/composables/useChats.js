import { computed, reactive, ref } from 'vue';
import * as chatsApi from '@/lib/chats';
import { CHAT_TYPES } from '@/lib/neurals';

/**
 * Списки чатов по разделам. Раздел — это тип генерации, и отбирает по нему бэкенд:
 * `GET /chats?type=` возвращает только свои чаты, а не всё подряд с отсевом на клиенте.
 *
 * У каждого раздела своя запись: возврат на вкладку показывает список сразу, без запроса.
 */
const lists = reactive(
	Object.fromEntries(
		CHAT_TYPES.map((type) => [type, { items: [], total: 0, loaded: false, isLoading: false }]),
	),
);

/** Раздел, который сейчас на экране: за ним следуют chats, total и isLoading */
const activeType = ref(CHAT_TYPES[0]);

export function useChats() {
	const chats = computed(() => lists[activeType.value]?.items ?? []);
	const total = computed(() => lists[activeType.value]?.total ?? 0);
	const isLoading = computed(() => Boolean(lists[activeType.value]?.isLoading));

	/** Превью карточек приходят вместе со списком — отдельных запросов за ними нет */
	async function load(type) {
		const list = lists[type];
		if (!list) return [];

		activeType.value = type;
		list.isLoading = true;
		try {
			const data = await chatsApi.fetchChats({ type });

			list.items = data.items;
			list.total = data.total;
			list.loaded = true;
		} finally {
			list.isLoading = false;
		}
		return list.items;
	}

	async function ensureLoaded(type) {
		const list = lists[type];
		if (!list) return [];

		activeType.value = type;
		return list.loaded ? list.items : load(type);
	}

	async function create({ type, model }) {
		const chatId = await chatsApi.createChat({ type, model });
		const list = lists[type];

		// Список раздела ещё не знает о чате: дорисовываем его сами, чтобы не ходить заново
		if (list) {
			list.items = [
				{ id: chatId, type, model, createdAt: new Date().toISOString() },
				...list.items,
			];
			list.total += 1;
		}

		return chatId;
	}

	/** Тип чата тут неизвестен — ищем его во всех разделах, их всего три */
	async function remove(chatId) {
		await chatsApi.deleteChat(chatId);

		for (const list of Object.values(lists)) {
			const rest = list.items.filter((chat) => chat.id !== chatId);
			if (rest.length === list.items.length) continue;

			list.items = rest;
			list.total = Math.max(0, list.total - 1);
		}
	}

	/** Обновляет превью чата после отправки или завершения генерации */
	function setLastMessage(chatId, message) {
		for (const list of Object.values(lists)) {
			const chat = list.items.find((item) => item.id === chatId);
			if (chat) {
				chat.lastMessage = message;
				return;
			}
		}
	}

	return { chats, total, isLoading, load, ensureLoaded, create, remove, setLastMessage };
}
