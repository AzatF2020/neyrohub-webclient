import { defineMiddleware } from 'astro:middleware';
import { fetchSession } from './lib/auth-server';

/** Разделы, доступные только с сессией */
const PROTECTED = ['/app'];
/** Страницы, куда авторизованному заходить незачем */
const GUEST_ONLY = ['/login', '/register'];

const startsWithSegment = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`);

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Прокси до бэкенда сами носят куку сессии — лишний запрос за ней тут не нужен
	if (startsWithSegment(pathname, '/api')) return next();

	const session = await fetchSession(context.request, context.clientAddress);
	context.locals.user = session?.user ?? null;
	context.locals.session = session?.session ?? null;

	if (!session && PROTECTED.some((prefix) => startsWithSegment(pathname, prefix))) {
		const redirectTo = encodeURIComponent(pathname + context.url.search);
		return context.redirect(`/login?redirect=${redirectTo}`);
	}

	if (session && GUEST_ONLY.some((prefix) => startsWithSegment(pathname, prefix))) {
		return context.redirect('/app');
	}

	return next();
});
