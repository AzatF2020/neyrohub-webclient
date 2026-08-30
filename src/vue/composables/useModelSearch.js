import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { fetchModels } from '@/lib/neurals';
import { useModels } from './useModels';

/** Пауза перед запросом: столько строка ждёт, пока человек допечатает */
const DELAY = 300;

/**
 * Поиск моделей. Ищет бэкенд (`GET /neurals?search=`), поэтому запрос уходит не на каждую
 * букву — строка сперва успокаивается. Пустой запрос на сервер не ходит вовсе: весь
 * справочник уже лежит в памяти после ensureLoaded.
 *
 * Ожидание ничем не показывается: пока новый ответ в пути, на экране остаётся прошлый
 * список. Заглушка на его месте мигала бы на каждую букву, а сказать «ничего не нашлось»
 * до ответа сервера значит соврать.
 */
export function useModelSearch() {
	const { models } = useModels();

	const query = ref('');
	/** Ответ последнего выполненного поиска; null — показываем весь справочник */
	const applied = ref(null);
	const isFailed = ref(false);

	const needle = computed(() => query.value.trim());
	const debounced = refDebounced(needle, DELAY);

	/** Ответы приходят не в том порядке, в каком уходили запросы: старый результат отбрасываем */
	let latest = 0;

	// Строку очистили — справочник возвращается сразу, ждать паузы и ответа тут нечего
	watch(needle, (value) => {
		if (value) return;

		latest += 1;
		applied.value = null;
		isFailed.value = false;
	});

	watch(debounced, async (value) => {
		if (!value) return;

		const ticket = ++latest;
		try {
			const found = await fetchModels(value);
			if (ticket !== latest) return;

			applied.value = found;
			isFailed.value = false;
		} catch {
			// Прошлый список оставляем на месте: он полезнее пустого экрана
			if (ticket === latest) isFailed.value = true;
		}
	});

	const results = computed(() => applied.value ?? models.value);

	function reset() {
		latest += 1;
		query.value = '';
		applied.value = null;
		isFailed.value = false;
	}

	return { query, needle, results, isFailed, reset };
}
