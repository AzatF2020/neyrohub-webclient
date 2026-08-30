import { computed, shallowRef } from 'vue';

/**
 * Разметку рисует тяжёлый модуль: markdown-it с katex и highlight.js — вместе
 * это заметно больше самого экрана чата. Поэтому грузим его отдельным чанком
 * при первом ответе модели, а до готовности показываем текст как есть.
 *
 * Загрузка одна на страницу, отсюда общий на всех shallowRef.
 */
const render = shallowRef(null);
let loading = null;

export function useMarkdown() {
	const isReady = computed(() => Boolean(render.value));

	function ensureLoaded() {
		loading ??= import('@/lib/markdown')
			.then((module) => (render.value = module.renderMarkdown))
			.catch((error) => {
				// Не загрузился — не беда: ответы останутся простым текстом
				console.error('[chat] разметка не загрузилась:', error);
				loading = null;
			});

		return loading;
	}

	function toHtml(text) {
		return render.value ? render.value(text) : '';
	}

	return { isReady, ensureLoaded, toHtml };
}
