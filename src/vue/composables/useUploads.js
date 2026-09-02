import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiErrorText } from '@/lib/api';
import {
	MAX_FILE_SIZE,
	deleteFile,
	fileMime,
	isCanceled,
	isVideoMime,
	uploadFile,
} from '@/lib/files';
import { isVideoField } from '@/lib/neurals';
import { useFileLinks } from './useFileLinks';

/**
 * Вложения композера: файлы с диска и вставленные ссылки в одном списке.
 *
 * Файл уезжает в хранилище сразу при выборе — к моменту отправки он уже там, и генерация
 * не ждёт сотню мегабайт. В options модели уходят ссылки, поэтому у загруженного файла
 * держим и идентификатор, и последнюю ссылку на него.
 */

/** Ключ вложения: файлы бывают одинаковыми, а список — общим для всех полей модели */
let lastKey = 0;

export function useUploads() {
	const { t } = useI18n();
	const { linkFor } = useFileLinks();

	const items = ref([]);

	/** Пока файл едет, отправлять нечего: ссылки на него ещё нет */
	const isUploading = computed(() => items.value.some((item) => item.status === 'uploading'));
	const hasFailed = computed(() => items.value.some((item) => item.status === 'failed'));

	function itemsOf(fieldName) {
		return items.value.filter((item) => item.field === fieldName);
	}

	function errorText(error) {
		switch (error?.fileError) {
			case 'type':
				return t('files.unknownType');
			case 'size':
				return t('files.tooLarge', { limit: Math.round(MAX_FILE_SIZE / 1024 / 1024) });
			case 'empty':
				return t('files.empty');
			default:
				return apiErrorText(error) ?? t('files.failed');
		}
	}

	/** Кладёт выбранные файлы в очередь. Больше, чем модель принимает, не берём */
	function add(field, files) {
		const free = Math.max((field.max ?? Infinity) - itemsOf(field.name).length, 0);

		for (const file of [...files].slice(0, free)) {
			const item = reactive({
				key: `upload-${(lastKey += 1)}`,
				field: field.name,
				isVideo: isVideoMime(fileMime(file)),
				name: file.name,
				file,
				// Превью берём у самого файла: он тут же, на диске, — сервер тут ни при чём
				preview: URL.createObjectURL(file),
				fileId: '',
				url: '',
				progress: 0,
				status: 'uploading',
				error: '',
				controller: null,
			});

			items.value = [...items.value, item];
			void start(item);
		}
	}

	/** Ссылку грузить некуда: провайдер заберёт файл по ней сам */
	function addLink(field, url) {
		const free = (field.max ?? Infinity) - itemsOf(field.name).length;
		if (free <= 0) return false;

		items.value = [
			...items.value,
			reactive({
				key: `upload-${(lastKey += 1)}`,
				field: field.name,
				isVideo: isVideoField(field),
				name: url,
				file: null,
				preview: url,
				fileId: '',
				url,
				progress: 100,
				status: 'ready',
				error: '',
				controller: null,
			}),
		];

		return true;
	}

	async function start(item) {
		item.status = 'uploading';
		item.progress = 0;
		item.error = '';
		item.controller = new AbortController();

		try {
			const file = await uploadFile(item.file, {
				onProgress: (percent) => (item.progress = percent),
				signal: item.controller.signal,
			});

			item.fileId = file.id;
			// Ссылка нужна ещё до отправки — по ней считается цена; к отправке её обновит кэш
			item.url = await linkFor(file.id);
			item.status = item.url ? 'ready' : 'failed';
			if (!item.url) item.error = t('files.linkFailed');
		} catch (error) {
			// Загрузку прервали своей же кнопкой — вложения уже нет, говорить не о чем
			if (isCanceled(error)) return;

			console.warn('[files] загрузка не удалась:', error);
			item.status = 'failed';
			item.error = errorText(error);
		} finally {
			item.controller = null;
		}
	}

	/** Файл уже в хранилище — не хватило только ссылки: второй раз его гнать незачем */
	async function relink(item) {
		item.status = 'uploading';
		item.progress = 100;
		item.error = '';

		item.url = await linkFor(item.fileId, { force: true });
		item.status = item.url ? 'ready' : 'failed';
		if (!item.url) item.error = t('files.linkFailed');
	}

	function retry(item) {
		if (item.status === 'uploading') return;

		void (item.fileId ? relink(item) : start(item));
	}

	function release(item, { discard = false } = {}) {
		item.controller?.abort();
		if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
		// Вложение убрали до отправки: незачем ему лежать в хранилище следующие 30 дней
		if (discard && item.fileId) deleteFile(item.fileId).catch(() => {});
	}

	function remove(item) {
		release(item, { discard: true });
		items.value = items.value.filter((current) => current.key !== item.key);
	}

	/** discard — вложения никуда не ушли (сменили модель, закрыли экран), файлы можно убрать */
	function clear({ discard = false } = {}) {
		for (const item of items.value) release(item, { discard });
		items.value = [];
	}

	/**
	 * Ссылки к отправке, по полям схемы. Берём их прямо перед генерацией, а не при загрузке:
	 * ссылка живёт час, а вложение могли приложить и раньше. Пусто — файла уже нет; такое
	 * вложение помечаем ошибкой, и отправлять запрос без него нельзя.
	 */
	async function resolve() {
		const values = {};

		for (const item of items.value) {
			const url = item.fileId ? await linkFor(item.fileId) : item.url;

			if (!url) {
				item.status = 'failed';
				item.error = t('files.gone');
				return null;
			}
			values[item.field] = [...(values[item.field] ?? []), url];
		}

		return values;
	}

	return { items, isUploading, hasFailed, itemsOf, add, addLink, remove, retry, clear, resolve };
}
