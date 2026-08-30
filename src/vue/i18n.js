import { createI18n } from 'vue-i18n';
import { setDateLocale } from '@/lib/datetime';
import en from './locales/en';
import ru from './locales/ru';

export const SUPPORTED_LOCALES = ['ru', 'en'];
export const DEFAULT_LOCALE = 'ru';

/**
 * Русские формы множественного числа: 1 кредит, 2 кредита, 5 кредитов. Своя нужна
 * потому, что встроенное правило vue-i18n английское — на «21 кредитов» оно и ломается.
 */
function russianPlural(choice) {
	const tail = Math.abs(choice) % 100;
	const last = Math.abs(choice) % 10;

	if (tail >= 11 && tail <= 14) return 2;
	if (last === 1) return 0;
	if (last >= 2 && last <= 4) return 1;

	return 2;
}

export const i18n = createI18n({
	legacy: false,
	locale: DEFAULT_LOCALE,
	fallbackLocale: 'en',
	messages: { ru, en },
	pluralRules: { ru: russianPlural },
});

/** Меняет язык интерфейса и формат дат заодно */
export function setLocale(locale) {
	if (!SUPPORTED_LOCALES.includes(locale)) return;
	i18n.global.locale.value = locale;
	setDateLocale(locale);
	document.documentElement.lang = locale;
}
