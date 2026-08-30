import type { APIRoute } from 'astro';
import { API_ORIGIN } from 'astro:env/server';
import { forwardHeaders } from '../../lib/auth-server';

/**
 * Прокси на прикладное API бэкенда: /api/chats → http://localhost:8080/chats.
 * Браузер общается только со своим origin, поэтому httpOnly-кука сессии уезжает
 * на бэкенд как обычная кука первой стороны и CORS не нужен.
 *
 * `/api/auth/*` сюда не попадает: у роута рядом статический сегмент, он специфичнее.
 */

const SKIP_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const SKIP_RESPONSE_HEADERS = new Set([
	'content-encoding',
	'content-length',
	'transfer-encoding',
	'connection',
	'keep-alive',
]);

const proxy: APIRoute = async ({ request, params, url, clientAddress }) => {
	const path = params.path ? `/${params.path}` : '';
	const target = `${API_ORIGIN.replace(/\/$/, '')}${path}${url.search}`;

	const headers = forwardHeaders(request, clientAddress);
	request.headers.forEach((value, name) => {
		if (!SKIP_REQUEST_HEADERS.has(name) && !headers.has(name)) headers.set(name, value);
	});

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
		console.error('[api] бэкенд недоступен:', error);
		return Response.json({ message: 'API backend unavailable' }, { status: 502 });
	}

	const outgoing = new Headers();
	response.headers.forEach((value, name) => {
		if (!SKIP_RESPONSE_HEADERS.has(name)) outgoing.set(name, value);
	});

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: outgoing,
	});
};

export const ALL = proxy;
