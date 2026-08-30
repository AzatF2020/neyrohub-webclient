import axios from 'axios';
import { PUBLIC_API_BASE_URL } from 'astro:env/client';

/** Клиент для прикладного API. Авторизация едет в httpOnly-куке, токены руками не носим. */
export const api = axios.create({
	baseURL: PUBLIC_API_BASE_URL,
	withCredentials: true,
	timeout: 20000,
	headers: { Accept: 'application/json' },
});

/** Сессия кончилась: уводим на форму входа и запоминаем, куда человек шёл */
export function redirectToLogin() {
	if (typeof window === 'undefined') return;

	const redirect = encodeURIComponent(window.location.pathname + window.location.search);
	window.location.assign(`/login?redirect=${redirect}`);
}

api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) redirectToLogin();
		return Promise.reject(error);
	},
);

/**
 * Текст ошибки из ответа Nest: { message: string | string[] }.
 * Возвращает null, когда сказать нечего — интерфейс подставит общее сообщение.
 */
export function apiErrorText(error) {
	const message = error?.response?.data?.message;

	if (Array.isArray(message)) return message.join('. ');
	if (typeof message === 'string' && message) return message;

	return null;
}
