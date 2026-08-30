import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { fetchPrice } from '@/lib/pricing';

/**
 * Пауза перед расчётом. Параметры крутят стрелками и колёсиком — от 480p до 1080p
 * три шага, от 6 секунд до 30 их два десятка, и считать каждый незачем: цена
 * интересна та, на которой человек остановился.
 */
const DELAY = 800;

/**
 * Цена набора параметров не меняется, пока жива страница: посчитанное помним и
 * второй раз не спрашиваем. Возврат к прошлому разрешению показывает цену мгновенно.
 */
const cache = new Map();

/** Расчёты в полёте: один набор в двух местах экрана — один запрос на двоих */
const pending = new Map();

/** Один и тот же набор опций должен давать одну строку — порядок ключей не важен */
function requestKey(request) {
	if (!request?.type || !request?.model) return '';

	const options = Object.entries(request.options ?? {})
		.filter(([, value]) => value !== '' && value !== null && value !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));

	return JSON.stringify([request.type, request.model, options]);
}

function load(key, request) {
	let inflight = pending.get(key);

	if (!inflight) {
		inflight = fetchPrice(request)
			.then((price) => {
				cache.set(key, price);
				return price;
			})
			.finally(() => pending.delete(key));
		pending.set(key, inflight);
	}

	return inflight;
}

/**
 * Цена генерации для набора параметров. `source` — функция, возвращающая
 * `{ type, model, options }` или ничего, пока считать нечего.
 *
 * Первый расчёт уходит сразу — ценник нужен, как только виден. Дальше запрос ждёт,
 * пока параметры успокоятся: пауза общая на весь набор, а не на каждое поле.
 */
export function useModelPrice(source) {
	const request = computed(() => source());
	const key = computed(() => requestKey(request.value));
	const debounced = refDebounced(key, DELAY);

	/**
	 * Набор, который пора считать: тот, на котором параметры успокоились. Пока пауза
	 * не вышла, здесь пусто — и запрос не уходит. Возврат к набору, который ещё
	 * считается, снова приводит сюда его же: ожидание подхватится, а не потеряется.
	 */
	const target = computed(() => (debounced.value === key.value ? key.value : ''));

	const price = ref(null);
	const isLoading = ref(false);
	const isFailed = ref(false);

	/** Ответы приходят не в том порядке, в каком уходили запросы: старый отбрасываем */
	let latest = 0;

	// Параметры сменились — прошлая цена уже не про них: убираем сразу, не дожидаясь ответа
	watch(
		key,
		(value) => {
			latest += 1;
			const known = cache.get(value);

			price.value = known ?? null;
			isFailed.value = false;
			isLoading.value = Boolean(value) && !known;
		},
		{ immediate: true },
	);

	watch(target, run, { immediate: true });

	async function run(value) {
		if (!value) return;

		const known = cache.get(value);
		if (known) {
			price.value = known;
			isLoading.value = false;
			return;
		}

		const ticket = ++latest;
		isLoading.value = true;

		try {
			const result = await load(value, request.value);
			if (ticket !== latest) return;

			price.value = result;
			isFailed.value = false;
		} catch (error) {
			// Цену не показываем вовсе, но и экран из-за неё не рушим: генерации это не мешает
			console.error('[pricing] не удалось посчитать цену:', error);
			if (ticket !== latest) return;

			isFailed.value = true;
		} finally {
			if (ticket === latest) isLoading.value = false;
		}
	}

	return { price, isLoading, isFailed };
}
