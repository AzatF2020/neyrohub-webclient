import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';
import { PUBLIC_AUTH_BASE_URL } from 'astro:env/client';

/**
 * Пусто → запросы идут на свой origin (/api/auth/*), а Astro проксирует их на бэкенд.
 * Задан → браузер ходит на бэкенд напрямую; тогда его trustedOrigins должен содержать адрес фронта.
 */
function resolveTarget() {
	if (!PUBLIC_AUTH_BASE_URL) return { basePath: '/api/auth' };
	const url = new URL(PUBLIC_AUTH_BASE_URL);
	return { baseURL: url.origin, basePath: url.pathname.replace(/\/$/, '') || '/api/auth' };
}

export const authClient = createAuthClient({
	...resolveTarget(),
	// httpOnly-кука сессии: её ставит и читает браузер, в JS она недоступна
	fetchOptions: { credentials: 'include' },
	plugins: [adminClient()],
});

/** Коды better-auth → ключи локализации (src/vue/locales) */
const ERROR_KEYS = {
	INVALID_EMAIL_OR_PASSWORD: 'errors.invalidCredentials',
	USER_ALREADY_EXISTS: 'errors.userExists',
	PASSWORD_TOO_SHORT: 'errors.passwordTooShort',
	INVALID_PASSWORD: 'errors.invalidPassword',
	SESSION_EXPIRED: 'errors.sessionExpired',
	TOO_MANY_REQUESTS: 'errors.tooManyRequests',
};

export function authErrorKey(error) {
	return ERROR_KEYS[error?.code] ?? null;
}
