import { api } from './api';

/** TypeGenerationEnum бэкенда */
export const GenerationType = {
	Images: 'AiImages',
	Videos: 'AiVideos',
	Text: 'AiTextGenerate',
};

/**
 * Разделы списка чатов — это сами типы генерации: по одной вкладке на каждый.
 * Раздел едет в адресе (`?type=`) и оттуда же уходит в запрос списка: фильтрует
 * бэкенд (`GET /chats?type=`), клиенту незачем тянуть чужие чаты и отсеивать их у себя.
 * Порядок задан руками — так разделы стоят и во вкладках, и в боковом меню.
 */
export const CHAT_TYPES = [GenerationType.Images, GenerationType.Videos, GenerationType.Text];

/** MessageRoleEnum бэкенда: роль реплики в переписке текстового чата */
export const MessageRole = {
	User: 'user',
	Assistant: 'assistant',
};

/** TaskStatusEnum бэкенда */
export const TaskStatus = {
	Created: 'created',
	Pending: 'pending',
	Success: 'success',
	Failed: 'failed',
};

/** Задача ещё в работе: место под результат уже есть, самого результата пока нет */
export function isPending(status) {
	return status === TaskStatus.Created || status === TaskStatus.Pending;
}

/**
 * Текстовые модели отвечают потоком в том же запросе: фоновой задачи с taskId
 * у них нет, поэтому сокет и опрос статусов таким чатам не нужны.
 */
export function isTextGeneration(type) {
	return type === GenerationType.Text;
}

/** Раздел из адреса: чужому значению вкладки нет, и списка «всех чатов» тоже нет */
export function isGenerationType(value) {
	return CHAT_TYPES.includes(value);
}

/**
 * `GET /neurals` отдаёт модели, сгруппированные по типу генерации: { AiImages: [...] }.
 * Интерфейсу удобнее плоский список, тип переносим в саму модель.
 *
 * Строка поиска уезжает на бэкенд — он ищет по слагу и названию. Параметр `type` не
 * передаём сознательно: с ним ответ приходит плоским массивом, без разбивки по типам,
 * а тип нужен интерфейсу для вкладок и ленты. Отбор по типу дешевле сделать здесь.
 */
export async function fetchModels(search) {
	const { data } = await api.get('/neurals', { params: search ? { search } : undefined });
	const grouped = data?.models ?? {};

	return Object.entries(grouped).flatMap(([type, models]) =>
		(models ?? []).map((model) => ({ ...model, type })),
	);
}

/**
 * Поля-вложения в схеме модели. Загрузки файлов на бэкенде нет: и картинки, и видео
 * едут ссылками, провайдер скачивает их сам. Полей может быть несколько — minimax-h3
 * принимает референсные картинки и ролики отдельными списками и в одном запросе.
 */
const ATTACHMENT_TYPES = ['image_list', 'video_list'];

export function attachmentFields(options) {
	return (options ?? []).filter((field) => ATTACHMENT_TYPES.includes(field.type));
}

/** Ролики показывают кадром, картинки — самой картинкой, поэтому вид поля важен */
export function isVideoField(field) {
	return field?.type === 'video_list';
}

/**
 * Вложения запроса: какие поля их держат, известно из схемы модели, а какого они
 * вида — из типа поля. Порядок полей сохраняем — он же был в форме.
 */
export function readAttachments(options, params) {
	return attachmentFields(options).flatMap((field) =>
		(params?.[field.name] ?? []).map((url) => ({ url, isVideo: isVideoField(field) })),
	);
}

/**
 * Значок модели лежит в public/models/<slug>.svg. Файла может не быть —
 * тогда интерфейс показывает запасную иконку.
 */
export function modelLogo(model) {
	return model ? `/models/${model}.svg` : '';
}

/**
 * Пропорции из схемы модели — «16:9» и подобные. Для значений вроде «auto»
 * формы нет: возвращаем null, интерфейс покажет квадрат пунктиром.
 */
export function parseRatio(value) {
	const match = /^(\d+):(\d+)$/.exec(value ?? '');
	return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/**
 * Результат генерации: у изображений и видео это массив ссылок, у текста — { message }.
 * resultUrls остаётся у сообщений, записанных до перехода на массив, и в редком случае,
 * когда провайдер вернул ответ без ссылок и бэкенд отдал его как есть.
 */
export function readOutput(output) {
	if (Array.isArray(output)) return { urls: output, text: '' };
	if (typeof output?.message === 'string') return { urls: [], text: output.message };
	if (Array.isArray(output?.resultUrls)) return { urls: output.resultUrls, text: '' };

	return { urls: [], text: '' };
}
