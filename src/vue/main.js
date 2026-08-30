import { createApp } from 'vue';
import App from './App.vue';
import { useSession } from './composables/useSession';
import { i18n } from './i18n';
import { router } from './router';

/** Точка входа SPA: Astro отдаёт оболочку и вызывает это из своего скрипта */
export function mountApp(el, initial = {}) {
	useSession().hydrate(initial.user, initial.session);
	createApp(App).use(router).use(i18n).mount(el);
}
