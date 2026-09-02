import { computed, reactive, ref, watch } from 'vue';
import { LINK_TTL, fetchFileLink, fileIdOfUrl, isFileLink, rememberFileUrl } from '@/lib/files';

/**
 * Ссылки на файлы хранилища.
 *
 * `output` сообщения и вложения запроса держат либо ссылку провайдера, либо идентификатор
 * файла — второй превращается в ссылку запросом, и она живёт час. Кэш общий на страницу:
 * один и тот же файл нужен и ленте, и обложке чата, и отправке, а запрос за ссылкой у них
 * был бы каждый свой.
 */

/** fileId → ссылка. Пустая строка при известном сроке — файла больше нет */
const links = reactive({});
/** fileId → до какого момента ссылку можно отдавать из кэша */
const expiry = new Map();
/** fileId → запрос в полёте: второй такой же незачем */
const inFlight = new Map();

export function useFileLinks() {
	function isFresh(fileId) {
		return (expiry.get(fileId) ?? 0) > Date.now();
	}

	/** Ссылка из кэша без запроса: пусто — её ещё не спрашивали или файла уже нет */
	function cachedLink(fileId) {
		return links[fileId] ?? '';
	}

	async function request(fileId) {
		try {
			const url = await fetchFileLink(fileId);
			links[fileId] = url;
			expiry.set(fileId, Date.now() + LINK_TTL);
			// Ссылка уедет в options и останется в запросе сообщения — пусть её будет чем обновить
			rememberFileUrl(url, fileId);

			return url;
		} catch (error) {
			// 404 — файла нет и не будет: помним и это, иначе лента спрашивала бы его без конца
			if (error.response?.status === 404) {
				links[fileId] = '';
				expiry.set(fileId, Date.now() + LINK_TTL);
			}

			return '';
		} finally {
			inFlight.delete(fileId);
		}
	}

	/**
	 * Ссылка на файл. Готовую ссылку отдаёт как есть — в старом формате `output` и в
	 * событии сокета лежат ссылки провайдера, и различать их дальше по коду не нужно.
	 */
	function linkFor(item, { force = false } = {}) {
		if (!item) return Promise.resolve('');
		if (isFileLink(item)) return Promise.resolve(item);
		if (!force && isFresh(item)) return Promise.resolve(links[item]);

		if (!inFlight.has(item)) inFlight.set(item, request(item));

		return inFlight.get(item);
	}

	/** Ссылка протухла: у той, что мы сами загружали, известен файл — берём свежую */
	async function refreshLink(url) {
		const fileId = fileIdOfUrl(url);
		return fileId ? linkFor(fileId, { force: true }) : '';
	}

	return { cachedLink, linkFor, refreshLink };
}

/**
 * Ссылки на результаты одного сообщения. Формат `output` поддерживаем оба сразу: событие
 * сокета приходит раньше, чем бэкенд перекладывает файлы к себе, поэтому у одной и той же
 * задачи в ленте сначала окажутся ссылки провайдера, а после перечитывания — идентификаторы.
 */
export function useMediaLinks(source) {
	const { cachedLink, linkFor } = useFileLinks();

	const urls = ref([]);
	const isResolving = ref(false);
	let run = 0;

	const items = computed(() => (source() ?? []).map(String));
	// Следим за содержимым, а не за массивом: readOutput собирает его заново на каждый рендер
	const key = computed(() => items.value.join('\n'));

	watch(key, resolve, { immediate: true });

	async function resolve() {
		const current = items.value;
		const previous = urls.value;
		const token = (run += 1);

		// Ссылки и уже известные файлы показываем сразу, остальное — как приедет. На месте
		// незнакомого файла оставляем прежнюю ссылку: тот же результат под другим адресом
		// приходит, когда бэкенд перекладывает файлы задачи к себе, и мигать тут нечему.
		urls.value = current.map(
			(item, index) => (isFileLink(item) ? item : cachedLink(item)) || previous[index] || '',
		);
		if (current.every((item) => isFileLink(item) || cachedLink(item))) return;

		isResolving.value = true;
		try {
			const resolved = await Promise.all(current.map((item) => linkFor(item)));
			// Пусто — файла уже нет либо запрос не дошёл: прежняя ссылка полезнее пустого места
			if (token === run) {
				urls.value = resolved.map((url, index) => url || previous[index] || '');
			}
		} finally {
			if (token === run) isResolving.value = false;
		}
	}

	/** Файл не загрузился: у своей ссылки истёк час — запрашиваем новую */
	async function refresh(index) {
		const item = items.value[index];
		if (!item || isFileLink(item)) return;

		const url = await linkFor(item, { force: true });
		if (url === urls.value[index]) return;

		urls.value = urls.value.map((old, position) => (position === index ? url : old));
	}

	return { urls, isResolving, refresh };
}
