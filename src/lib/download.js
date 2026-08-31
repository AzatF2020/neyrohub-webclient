/**
 * Сохранение файла на устройство силами браузера.
 *
 * Атрибут `download` у ссылки действует только для своего origin, а результат генерации
 * лежит на CDN провайдера: кросс-доменную ссылку браузер просто откроет вместо скачивания.
 * Поэтому файл забираем запросом и сохраняем уже blob — он свой, и имя файла у него наше.
 * Если CDN не отдаёт CORS-заголовки, запрос не пройдёт: тогда открываем оригинал в новой
 * вкладке, сохранить оттуда человек сможет сам.
 */

/** Имя, когда в ссылке его нет: у CDN путь бывает вида /download?token=… */
const FALLBACK_NAME = 'neyrohub';

/** Похоже на имя файла: без слэшей и с коротким расширением на конце */
const FILENAME = /^[\w.-]+\.[a-z0-9]{2,5}$/i;

const EXTENSIONS = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
};

/** Расширение берём из типа blob: в ссылке его может не быть вовсе */
export function filenameFor(url, type = '') {
	const path = pathnameOf(url);
	const name = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
	if (FILENAME.test(name)) return name;

	const extension = EXTENSIONS[type.split(';')[0].trim()] ?? 'bin';
	return `${FALLBACK_NAME}-${Date.now()}.${extension}`;
}

/** true — файл ушёл в загрузки, false — сохранить его человеку придётся из новой вкладки */
export async function saveFile(url, name = '') {
	try {
		// credentials: 'omit' — на чужой CDN куки не нужны, а с ними ответ может стать непубличным
		const response = await fetch(url, { credentials: 'omit' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const blob = await response.blob();
		const href = URL.createObjectURL(blob);
		clickLink(href, name || filenameFor(url, blob.type));
		// Отзываем с задержкой: скачивание стартует уже после того, как клик обработан
		setTimeout(() => URL.revokeObjectURL(href), 60_000);

		return true;
	} catch (error) {
		console.warn('[download] файл не забрать запросом, открываем оригинал:', error);
		window.open(url, '_blank', 'noopener');

		return false;
	}
}

function clickLink(href, download) {
	const link = document.createElement('a');
	link.href = href;
	link.download = download;
	link.rel = 'noopener';

	document.body.append(link);
	link.click();
	link.remove();
}

function pathnameOf(url) {
	try {
		return new URL(url, window.location.origin).pathname;
	} catch {
		return '';
	}
}
