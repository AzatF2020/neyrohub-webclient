import { io } from 'socket.io-client';
import { ref } from 'vue';
import { PUBLIC_SOCKET_URL } from 'astro:env/client';

// Соединение одно на страницу: комнаты чатов делят его между собой
const isConnected = ref(false);
let socket = null;

function getSocket() {
	if (socket) return socket;

	// Без credentials: gateway отдаёт CORS '*', а с ним браузер запрещает слать куки.
	// Когда на бэкенде появится проверка сессии, здесь нужен withCredentials, а там — конкретный origin
	socket = io(PUBLIC_SOCKET_URL || window.location.origin);
	socket.on('connect', () => (isConnected.value = true));
	socket.on('disconnect', () => (isConnected.value = false));

	return socket;
}

export function useSocket() {
	/**
	 * Подписывает на события комнаты и возвращает функцию отписки.
	 * join повторяется после каждого переподключения: комнаты живут в самом соединении.
	 */
	function subscribe(room, handlers) {
		const client = getSocket();
		const join = () => client.emit('join', room);

		// Комнату мы покидаем сами, но событие уже могло уйти в полёт — отсеиваем по room
		const bound = Object.entries(handlers).map(([event, handler]) => [
			event,
			(payload) => {
				if (!payload?.room || payload.room === room) handler(payload);
			},
		]);

		if (client.connected) join();
		client.on('connect', join);
		bound.forEach(([event, handler]) => client.on(event, handler));

		return () => {
			client.off('connect', join);
			bound.forEach(([event, handler]) => client.off(event, handler));
			// После реконнекта комнат всё равно нет: слать leave есть смысл только на живом соединении
			if (client.connected) client.emit('leave', room);
		};
	}

	return { isConnected, subscribe };
}
