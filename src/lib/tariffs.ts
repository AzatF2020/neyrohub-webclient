import { API_ORIGIN } from 'astro:env/server';
import { formatRubles } from './credits';

/** Запись из `GET /tariffs`. Пакет кредитов, который можно купить разово. */
export type Tariff = {
	id: number;
	slug: string;
	title?: string;
	description?: string;
	/** Копейки: колонка целочисленная, поэтому 390 ₽ приходят как 39000 */
	price: number;
	credits: number;
	enabled?: boolean;
};

/** Пакеты, вынесенные на страницу крупными карточками; первый из них помечен как рекомендуемый */
export const HIGHLIGHTED_TARIFFS = ['basic', 'pro'];

const TIMEOUT_MS = 5000;

/**
 * Тарифы для страницы цен. Ходим на бэкенд напрямую, а не через прокси `/api`:
 * страница рендерится на сервере, своего же origin у неё в этот момент ещё нет.
 *
 * Ручка анонимная, куки не нужны. Бэкенд может быть недоступен — страница из-за
 * этого не падает: возвращаем пустой список, разметка покажет заглушку.
 */
export async function fetchTariffs(): Promise<Tariff[]> {
	const target = `${API_ORIGIN.replace(/\/$/, '')}/tariffs`;

	try {
		const response = await fetch(target, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const data: unknown = await response.json();
		if (!Array.isArray(data)) return [];

		return (data as Tariff[]).filter((tariff) => tariff.enabled !== false);
	} catch (error) {
		console.error('[tariffs] не удалось получить тарифы:', error);
		return [];
	}
}

/** Пакеты в продаже, от дешёвого к дорогому */
export function paidTariffs(tariffs: Tariff[]): Tariff[] {
	return tariffs.filter((tariff) => tariff.price > 0).sort((a, b) => a.price - b.price);
}

/** Бесплатный тариф не продаётся: его начисляют при регистрации, и в сетке пакетов ему не место */
export function freeTariff(tariffs: Tariff[]): Tariff | null {
	return tariffs.find((tariff) => tariff.price === 0) ?? null;
}

/**
 * Делит пакеты на два крупных и остальные — строкой под ними.
 * Слаги могут разойтись с базой, тарифы правятся там же: тогда берём пару средних по цене.
 * Края в акценте бесполезны — самый дешёвый ничего не показывает, самый дорогой отпугивает.
 */
export function splitTariffs(packages: Tariff[]): { featured: Tariff[]; rest: Tariff[] } {
	const bySlug = HIGHLIGHTED_TARIFFS.map((slug) =>
		packages.find((tariff) => tariff.slug === slug),
	).filter((tariff): tariff is Tariff => Boolean(tariff));

	const middle = Math.max(0, Math.floor((packages.length - 1) / 2));
	const featured = bySlug.length === 2 ? bySlug : packages.slice(middle, middle + 2);

	return { featured, rest: packages.filter((tariff) => !featured.includes(tariff)) };
}

/** Цена тарифа приходит в копейках: колонка целочисленная */
export function formatPrice(price: number): string {
	return formatRubles(price / 100);
}

// Формат чисел общий с интерфейсом генераций, поэтому он живёт в ./credits
export { creditsLabel, formatCredits } from './credits';
