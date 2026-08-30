import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale('ru');

export function setDateLocale(locale) {
	dayjs.locale(locale);
}

export function formatDateTime(value) {
	return value ? dayjs(value).format('D MMMM YYYY, HH:mm') : '—';
}

export function formatDate(value) {
	return value ? dayjs(value).format('D MMMM YYYY') : '—';
}

export function formatTime(value) {
	return value ? dayjs(value).format('HH:mm') : '—';
}

export function fromNow(value) {
	return value ? dayjs(value).fromNow() : '—';
}

export default dayjs;
