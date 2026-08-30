import { createRouter, createWebHistory } from 'vue-router';
import { CHAT_TYPES, isGenerationType } from '@/lib/neurals';
import { i18n } from './i18n';
import { useSession } from './composables/useSession';

/** Кабинет открывается на изображениях: обзорной страницы и списка «всех чатов» у него нет */
const HOME = { name: 'chats', query: { type: CHAT_TYPES[0] } };

const routes = [
	{
		path: '/',
		component: () => import('./layouts/AuthLayout.vue'),
		meta: { guestOnly: true },
		children: [
			{
				path: 'login',
				name: 'login',
				component: () => import('./views/Login.vue'),
				meta: { titleKey: 'auth.loginTitle' },
			},
			{
				path: 'register',
				name: 'register',
				component: () => import('./views/Register.vue'),
				meta: { titleKey: 'auth.registerTitle' },
			},
		],
	},
	{
		path: '/app',
		component: () => import('./layouts/AccountLayout.vue'),
		meta: { requiresAuth: true },
		children: [
			{ path: '', redirect: HOME },
			{
				path: 'chats',
				name: 'chats',
				component: () => import('./views/Chats.vue'),
				meta: { titleKey: 'chats.title' },
			},
			{
				path: 'chats/new',
				name: 'chat-new',
				component: () => import('./views/Chat.vue'),
				meta: { titleKey: 'chats.newTitle', fullHeight: true },
			},
			{
				path: 'chats/:id',
				name: 'chat',
				component: () => import('./views/Chat.vue'),
				meta: { titleKey: 'chats.title', fullHeight: true },
			},
			{
				path: 'profile',
				name: 'profile',
				component: () => import('./views/Profile.vue'),
				meta: { titleKey: 'account.nav.profile' },
			},
		],
	},
	{
		path: '/:pathMatch(.*)*',
		name: 'not-found',
		component: () => import('./views/NotFound.vue'),
		meta: { titleKey: 'account.notFoundTitle' },
	},
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
	scrollBehavior: () => ({ top: 0 }),
});

/**
 * Клиентская проверка дублирует серверную из src/middleware.ts: сессия может истечь
 * или быть отозвана (secondaryStorage в Redis) уже после загрузки страницы.
 */
router.beforeEach(async (to) => {
	const { user, ensureLoaded } = useSession();
	await ensureLoaded();

	const requiresAuth = to.matched.some((route) => route.meta.requiresAuth);
	if (requiresAuth && !user.value) {
		return { name: 'login', query: { redirect: to.fullPath } };
	}

	const guestOnly = to.matched.some((route) => route.meta.guestOnly);
	if (guestOnly && user.value) {
		return HOME;
	}

	// Список без раздела не существует: тип генерации нужен и запросу, и вкладкам
	if (to.name === 'chats' && !isGenerationType(to.query.type)) {
		return { ...HOME, replace: true };
	}

	return true;
});

router.afterEach((to) => {
	const { t } = i18n.global;
	const title = to.meta.titleKey ? t(to.meta.titleKey) : null;
	document.title = title ? `${title} — ${t('common.appName')}` : t('common.appName');
});
