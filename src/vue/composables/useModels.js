import { computed, ref } from 'vue';
import { fetchModels } from '@/lib/neurals';

/** Типы параметров, для которых композер умеет рисовать поле */
const CONTROL_TYPES = ['enum', 'number', 'boolean'];

// Справочник моделей меняется редко — держим его в памяти всё время жизни страницы
const models = ref([]);
const isLoading = ref(false);
let loaded = false;

export function useModels() {
	/** Модели, сгруппированные по типу генерации — в таком виде их показывает селект */
	const groups = computed(() => {
		const byType = new Map();
		for (const model of models.value) {
			if (!byType.has(model.type)) byType.set(model.type, []);
			byType.get(model.type).push(model);
		}
		return [...byType].map(([type, list]) => ({ type, models: list }));
	});

	async function ensureLoaded() {
		if (loaded || isLoading.value) return models.value;

		isLoading.value = true;
		try {
			models.value = await fetchModels();
			loaded = true;
		} finally {
			isLoading.value = false;
		}
		return models.value;
	}

	function find(slug) {
		return models.value.find((model) => model.model === slug);
	}

	/** Человекочитаемое имя модели; до загрузки справочника показываем сам slug */
	function modelName(slug) {
		return find(slug)?.name ?? slug;
	}

	/** Тип генерации модели: от него зависит и способ отправки, и вид ленты */
	function modelType(slug) {
		return find(slug)?.type ?? '';
	}

	/** Схема параметров генерации — её описывает бэкенд вместе со справочником */
	function modelOptions(slug) {
		return find(slug)?.options ?? [];
	}

	/** Параметры, под которые у композера есть поле: промпт и вложения он рисует сам */
	function modelControls(slug) {
		return modelOptions(slug).filter(
			(field) =>
				CONTROL_TYPES.includes(field.type) && (field.type !== 'enum' || field.values?.length),
		);
	}

	function defaultOptions(slug) {
		return Object.fromEntries(
			modelOptions(slug)
				.filter((field) => field.default !== undefined)
				.map((field) => [field.name, field.default]),
		);
	}

	return {
		models,
		groups,
		isLoading,
		ensureLoaded,
		modelName,
		modelType,
		modelOptions,
		modelControls,
		defaultOptions,
	};
}
