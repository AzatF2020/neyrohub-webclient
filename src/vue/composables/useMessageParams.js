import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useModels } from './useModels';

/**
 * Параметры запроса в человеческом виде. Общее место для генераций и реплик
 * чата: у первых они лежат в `input`, у вторых — в `params`, но показываем
 * одинаково. Аргументы — геттеры, чтобы значения оставались реактивными.
 */
export function useMessageParams(model, params) {
	const { t, te } = useI18n();
	const { defaultOptions } = useModels();

	// Вложения показываем картинками, поэтому в строке остаются только простые значения
	const entries = computed(() =>
		Object.entries(params() ?? {}).filter(
			([name, value]) => name !== 'prompt' && typeof value !== 'object' && value !== '',
		),
	);

	/** Для незнакомого параметра подписи нет — показываем его имя как есть */
	function label(name) {
		const key = `chats.options.${name}`;
		return te(key) ? t(key) : name;
	}

	/** Само по себе значение не всегда понятно: «true» и «12» ничего не говорят */
	function format(name, value) {
		if (typeof value === 'boolean') return t(value ? 'common.on' : 'common.off');
		if (name === 'duration') return t('chats.seconds', { count: value });

		return value;
	}

	/**
	 * В строке под запросом — только то, что человек менял: значения по умолчанию
	 * ничего не сообщают и лишь удлиняют сообщение.
	 */
	const summary = computed(() => {
		const defaults = defaultOptions(model());

		return entries.value
			.filter(([name, value]) => value !== defaults[name])
			.map(([name, value]) => format(name, value))
			.join(' · ');
	});

	/** Полный набор с подписями — в подсказке по наведению */
	const hint = computed(() =>
		entries.value.map(([name, value]) => `${label(name)}: ${format(name, value)}`).join('\n'),
	);

	return { summary, hint };
}
