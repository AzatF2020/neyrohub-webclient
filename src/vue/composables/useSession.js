import { computed, ref } from 'vue';
import { authClient } from '@/lib/auth-client';

// Состояние модульное: один экземпляр на всё приложение — то, ради чего раньше был стор
const user = ref(null);
const session = ref(null);
const isPending = ref(false);
let loaded = false;

export function useSession() {
	const isAuthenticated = computed(() => user.value !== null);
	const isAdmin = computed(() => user.value?.role === 'admin');

	/** Начальные данные приходят из SSR-разметки — интерфейс сразу знает, кто вошёл */
	function hydrate(initialUser, initialSession = null) {
		user.value = initialUser ?? null;
		session.value = initialSession ?? null;
	}

	async function refresh() {
		isPending.value = true;
		try {
			const { data } = await authClient.getSession();
			user.value = data?.user ?? null;
			session.value = data?.session ?? null;
			loaded = true;
			return user.value;
		} finally {
			isPending.value = false;
		}
	}

	/** Один запрос за сессией на всё время жизни страницы */
	async function ensureLoaded() {
		if (loaded) return user.value;
		return refresh();
	}

	async function signOut() {
		await authClient.signOut();
		user.value = null;
		session.value = null;
		loaded = false;
		// Полная перезагрузка: сервер должен перерисовать публичные страницы уже без пользователя
		window.location.href = '/';
	}

	return {
		user,
		session,
		isPending,
		isAuthenticated,
		isAdmin,
		hydrate,
		refresh,
		ensureLoaded,
		signOut,
	};
}
