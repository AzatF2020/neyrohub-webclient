import { AUTH_BASE_PATH, AUTH_ORIGIN } from 'astro:env/server';
import type { Session } from './auth-types';

/** Полный адрес better-auth на бэкенде: http://localhost:8080/api/auth */
export const AUTH_ENDPOINT = `${AUTH_ORIGIN.replace(/\/$/, '')}${AUTH_BASE_PATH}`;

/**
 * Cookie сессии better-auth: `better-auth.session_token`, под https — с префиксом `__Secure-`.
 * Проверяем её наличие, чтобы не дёргать бэкенд на каждый анонимный запрос.
 */
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/;

/** Заголовки запроса, которые имеет смысл донести до бэкенда как есть. */
const FORWARDED = ['cookie', 'authorization', 'user-agent', 'accept-language', 'origin', 'referer'];

export function forwardHeaders(request: Request, clientAddress: string | undefined): Headers {
	const headers = new Headers();

	for (const name of FORWARDED) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	// Иначе rate limit better-auth считал бы все запросы приходящими с IP сервера Astro
	if (clientAddress) {
		const existing = request.headers.get('x-forwarded-for');
		headers.set('x-forwarded-for', existing ? `${existing}, ${clientAddress}` : clientAddress);
	}
	return headers;
}

/**
 * Читает сессию на сервере Astro, передавая куки браузера бэкенду.
 * Возвращает null для анонимов и при любой ошибке связи — страница просто отрендерится как гостевая.
 */
export async function fetchSession(
	request: Request,
	clientAddress?: string,
): Promise<Session | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie || !SESSION_COOKIE.test(cookie)) return null;

	const headers = forwardHeaders(request, clientAddress);
	headers.set('accept', 'application/json');

	try {
		const response = await fetch(`${AUTH_ENDPOINT}/get-session`, { headers });
		if (!response.ok) return null;
		const data = (await response.json()) as Session | null;
		return data?.user ? data : null;
	} catch (error) {
		console.error('[auth] не удалось получить сессию с бэкенда:', error);
		return null;
	}
}
