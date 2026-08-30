import katexPlugin from '@vscode/markdown-it-katex';
import hljs from 'highlight.js/lib/common';
import MarkdownIt from 'markdown-it';
import 'katex/dist/katex.min.css';

/** Пакет собран как CJS: через интероп функция плагина лежит в default */
const katex = katexPlugin.default ?? katexPlugin;

/**
 * Разметка от модели: заголовки, списки, таблицы, блоки кода и формулы TeX.
 *
 * `html: false` — теги из ответа показываем текстом, а не исполняем. Поэтому
 * готовый HTML безопасно отдавать в `v-html`: ни разметки, ни скриптов из
 * ответа в него не попадёт, а ссылки markdown-it проверяет сам.
 */
const md = new MarkdownIt({
	html: false,
	linkify: true,
	// перевод строки в чате означает перевод строки, а не склейку абзаца
	breaks: true,
	highlight: highlightBlock,
});

md.use(katex, {
	// Незакрытая формула — обычное дело посреди стрима: показываем как есть
	throwOnError: false,
	errorColor: 'currentColor',
});

// Ссылка на сторонний сайт не должна уводить из SPA
md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
	tokens[index].attrSet('target', '_blank');
	tokens[index].attrSet('rel', 'noopener noreferrer');

	return self.renderToken(tokens, index, options);
};

// Широкую таблицу прокручиваем внутри своей обёртки, иначе она растягивает сообщение
md.renderer.rules.table_open = () => '<div class="markdown-scroll"><table>';
md.renderer.rules.table_close = () => '</table></div>';

/** Блок кода: язык берём из ограды ```lang, незнакомый — просто экранируем */
function highlightBlock(code, language) {
	const known = language && hljs.getLanguage(language);
	const body = known
		? hljs.highlight(code, { language, ignoreIllegals: true }).value
		: md.utils.escapeHtml(code);
	const label = known ? ` data-language="${md.utils.escapeHtml(language)}"` : '';

	// Строка с <pre> markdown-it повторно не оборачивает — классы навешиваем сами
	return `<pre class="markdown-scroll"${label}><code class="hljs">${body}</code></pre>`;
}

/**
 * Куски текста, внутри которых разделители формул трогать нельзя: блок кода,
 * код в кавычках и уже размеченная формула (в ней `\\[` — перенос строки, а не
 * начало блока). Всё, что не совпало с ними, — сами скобочные разделители.
 */
const TEX_SPANS =
	/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|(`+)[\s\S]*?\1|\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\(|\\\)|\\\[|\\\]/g;

/**
 * Модели пишут формулы двояко: `$…$` и скобками TeX — `\(…\)`, `\[…\]`.
 * Второй вид markdown-it принимает за экранированную пунктуацию и съедает
 * слэши, а плагин таких разделителей не знает — приводим их к долларам.
 */
function toDollars(text) {
	return text.replace(TEX_SPANS, (span) => {
		if (span === '\\(' || span === '\\)') return '$';
		if (span === '\\[' || span === '\\]') return '$$';

		return span;
	});
}

/**
 * Ответ модели в HTML. Зовётся на каждый кусок стрима, поэтому держим её
 * дешёвой: markdown-it парсит заново, но на размерах ответа это доли миллисекунды.
 */
export function renderMarkdown(text) {
	if (!text) return '';

	return md.render(toDollars(text));
}
