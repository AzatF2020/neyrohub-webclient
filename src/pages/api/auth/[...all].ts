import type { APIRoute } from 'astro';
import { AUTH_ENDPOINT, forwardHeaders } from '../../../lib/auth-server';

/**
 * Прокси на better-auth: браузер общается только со своим origin,
 * поэтому нет CORS, а httpOnly-кука сессии ставится на домен фронта
 * и доступна SSR-страницам Astro.
 */

const SKIP_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const SKIP_RESPONSE_HEADERS = new Set([
	'set-cookie',
	'content-encoding',
	'content-length',
	'transfer-encoding',
	'connection',
	'keep-alive',
]);

/**
 * Кука приходит с домена бэкенда. Убираем Domain, чтобы браузер привязал её к домену фронта,
 * а под локальным http снимаем Secure — иначе браузер её просто не сохранит.
 */
function adaptCookie(cookie: string, isSecureContext: boolean): string {
	return cookie
		.split(';')
		.filter((part) => {
			const attribute = part.trim().toLowerCase();
			if (attribute.startsWith('domain=')) return false;
			if (!isSecureContext && attribute === 'secure') return false;
			return true;
		})
		.join(';');
}

const proxy: APIRoute = async ({ request, params, url, clientAddress }) => {
	const path = params.all ? `/${params.all}` : '';
	const target = `${AUTH_ENDPOINT}${path}${url.search}`;

	const headers = forwardHeaders(request, clientAddress);
	request.headers.forEach((value, name) => {
		if (!SKIP_REQUEST_HEADERS.has(name) && !headers.has(name)) headers.set(name, value);
	});
	headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
	headers.set('x-forwarded-host', url.host);

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

	let response: Response;
	try {
		response = await fetch(target, {
			method: request.method,
			headers,
			body: hasBody ? await request.arrayBuffer() : undefined,
			redirect: 'manual',
		});
	} catch (error) {
		console.error('[auth] бэкенд недоступен:', error);
		return Response.json({ message: 'Auth backend unavailable' }, { status: 502 });
	}

	const outgoing = new Headers();
	response.headers.forEach((value, name) => {
		if (!SKIP_RESPONSE_HEADERS.has(name)) outgoing.set(name, value);
	});

	const isSecureContext = url.protocol === 'https:';
	for (const cookie of response.headers.getSetCookie()) {
		outgoing.append('set-cookie', adaptCookie(cookie, isSecureContext));
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: outgoing,
	});
};

export const ALL = proxy;
