/**
 * Кредиты и рубли в человеческом виде. Модуль общий для обеих сторон: пакеты на
 * странице тарифов считает Astro на сервере, цену генерации показывает Vue в браузере,
 * а формат у чисел один и тот же.
 */

const NUMBER = new Intl.NumberFormat('ru-RU');
const RUBLES = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
	maximumFractionDigits: 0,
});
const KOPECKS = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

/**
 * @param {number} credits
 * @returns {string}
 */
export function formatCredits(credits) {
	return NUMBER.format(credits);
}

/**
 * Рубли приходят числом с копейками (15.3). Копейки в ценнике не показываем, пока их там нет.
 * @param {number} rubles
 * @returns {string}
 */
export function formatRubles(rubles) {
	return Number.isInteger(rubles) ? RUBLES.format(rubles) : KOPECKS.format(rubles);
}

/**
 * «1 кредит», «2 кредита», «1 000 кредитов». Нужна там, где строки не проходят
 * через i18n: страницу тарифов рендерит Astro, локали Vue ей недоступны.
 * @param {number} credits
 * @returns {string}
 */
export function creditsLabel(credits) {
	const tail = credits % 100;
	const last = credits % 10;

	if (tail >= 11 && tail <= 14) return 'кредитов';
	if (last === 1) return 'кредит';
	if (last >= 2 && last <= 4) return 'кредита';

	return 'кредитов';
}
