import axios from 'axios';
import { api } from './api';

/**
 * Файлы для генерации.
 *
 * Загрузка одна: `POST /files`, multipart, тело идёт через бэкенд. Ручка принимает и пачку
 * (до 12 файлов), но мы шлём по файлу за запрос: вложения в композере живут порознь — у
 * каждого свои проценты, своя ошибка и своя кнопка повтора, — а пачка на бэкенде атомарна,
 * и один негодный файл увёл бы за собой остальные.
 *
 * Наружу модуль отдаёт идентификатор файла. Ссылку на него выдаёт только `fetchFileLink` —
 * бэкенд собирается принимать в options сам идентификатор и подставлять ссылку у себя,
 * и тогда правка будет здесь одна.
 */

/** Лимит бэкенда. Проверяем сами, чтобы сказать при выборе файла, а не после его отправки */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Ссылка из `/link` живёт час; своей считаем её на 50 минут — с запасом на долгую вкладку */
export const LINK_TTL = 50 * 60 * 1000;

/** У файла с диска mime бывает пустым — тогда берём его по расширению */
const MIME_BY_EXTENSION = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	heic: 'image/heic',
	heif: 'image/heif',
	bmp: 'image/bmp',
	mp4: 'video/mp4',
	m4v: 'video/x-m4v',
	mov: 'video/quicktime',
	webm: 'video/webm',
	mkv: 'video/x-matroska',
};

/**
 * Элемент `output` или вложения: ссылка провайдера или идентификатор нашего файла.
 * Различаем их ровно так, как договорились с бэкендом, — по схеме в начале строки.
 */
export function isFileLink(value) {
	return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/** mime обязателен и должен быть вида type/subtype: пустой бэкенд не примет */
export function fileMime(file) {
	const type = (file.type ?? '').split(';')[0].trim();
	if (/^[\w.+-]+\/[\w.+-]+$/.test(type)) return type;

	const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
	return MIME_BY_EXTENSION[extension] ?? '';
}

export function isVideoMime(mime) {
	return (mime ?? '').startsWith('video/');
}

/** Файл не подходит, и это видно до отправки: причина уезжает в интерфейс кодом */
function fileError(reason) {
	const error = new Error(`file rejected: ${reason}`);
	error.fileError = reason;

	return error;
}

/** Загрузку прервали кнопкой «убрать» или сменой модели — для интерфейса это не ошибка */
export function isCanceled(error) {
	return axios.isCancel(error);
}

/**
 * Кладёт файл в хранилище и возвращает его запись: { id, mime, size, status, ... }.
 * onProgress получает целые проценты отправки: fetch прогресса не даёт вовсе, поэтому
 * запрос идёт через axios с onUploadProgress.
 */
export async function uploadFile(file, { onProgress, signal } = {}) {
	const mime = fileMime(file);

	if (!mime) throw fileError('type');
	if (!file.size) throw fileError('empty');
	if (file.size > MAX_FILE_SIZE) throw fileError('size');

	const body = new FormData();
	// Тип проставляем явно: у файла с диска он бывает пустым, а мы его уже определили
	const payload = file.type === mime ? file : new File([file], file.name, { type: mime });
	body.append('file', payload, file.name);

	const { data } = await api.post('/files', body, {
		onUploadProgress: ({ loaded, total }) =>
			onProgress?.(total ? Math.round((loaded / total) * 100) : 0),
		signal,
		timeout: 0,
	});

	// Ответ всегда массив, даже на один файл
	const [uploaded] = Array.isArray(data) ? data : [];
	if (!uploaded?.id) throw new Error('files: неожиданный ответ на загрузку');

	return uploaded;
}

/**
 * Единственное место, где идентификатор превращается в ссылку. Ссылка временная (час),
 * поэтому кэшировать её надолго нельзя — этим заведует композабл useFileLinks.
 */
export async function fetchFileLink(fileId) {
	const { data } = await api.get(`/files/${fileId}/link`);
	return data.url;
}

/** Файл больше не нужен: убрали вложение до отправки, значит и в хранилище ему делать нечего */
export async function deleteFile(fileId) {
	await api.delete(`/files/${fileId}`);
}

/**
 * Какому файлу принадлежит ссылка.
 *
 * В options модели уходит ссылка, и в запросе сообщения она остаётся навсегда, а живёт час:
 * через час вложения в ленте перестали бы показываться. Списка файлов на бэкенде нет, связь
 * файлов с сообщениями фронт держит сам — вот он её и держит. Ключ — путь ссылки без подписи:
 * он один и тот же у всех ссылок на один объект.
 */
const FILE_URLS_KEY = 'neyrohub:file-urls';

/** Сколько ссылок помним. Файлы живут 30 дней, записи старше просто выкидываем */
const FILE_URLS_LIMIT = 300;
const FILE_URLS_TTL = 30 * 24 * 60 * 60 * 1000;

function urlKey(url) {
	try {
		return new URL(url, window.location.origin).pathname;
	} catch {
		return '';
	}
}

function readFileUrls() {
	try {
		const stored = JSON.parse(localStorage.getItem(FILE_URLS_KEY) ?? '{}');
		return stored && typeof stored === 'object' ? stored : {};
	} catch {
		return {};
	}
}

export function rememberFileUrl(url, fileId) {
	const key = urlKey(url);
	if (!key || !fileId) return;

	const stored = readFileUrls();
	stored[key] = { id: fileId, at: Date.now() };

	const fresh = Object.entries(stored)
		.filter(([, item]) => Date.now() - (item?.at ?? 0) < FILE_URLS_TTL)
		.sort(([, a], [, b]) => b.at - a.at)
		.slice(0, FILE_URLS_LIMIT);

	try {
		localStorage.setItem(FILE_URLS_KEY, JSON.stringify(Object.fromEntries(fresh)));
	} catch (error) {
		console.warn('[files] не удалось запомнить ссылку:', error);
	}
}

/** Пусто — ссылку не мы загружали (другой браузер, другой человек) или запись уже вытеснена */
export function fileIdOfUrl(url) {
	const key = urlKey(url);
	return key ? (readFileUrls()[key]?.id ?? '') : '';
}
