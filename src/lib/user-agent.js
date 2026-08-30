/**
 * Разбор User-Agent для списка активных сессий. В сыром виде строка вида
 * «Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 …» не читается,
 * а человеку нужно только узнать в списке своё устройство: браузер, систему и её тип.
 * Полноценный парсер ради трёх подписей тянуть незачем — хватает порядка проверок
 * от частного к общему: Edge и Яндекс представляются Chrome, Chrome — Safari.
 */

const BROWSERS = [
	[/\bEdgA?\//, 'Edge'],
	[/\bYaBrowser\//, 'Yandex Browser'],
	[/\b(?:OPR|Opera)\//, 'Opera'],
	[/\bSamsungBrowser\//, 'Samsung Internet'],
	[/\b(?:Firefox|FxiOS)\//, 'Firefox'],
	[/\b(?:Chrome|CriOS)\//, 'Chrome'],
	[/\bSafari\//, 'Safari'],
];

const SYSTEMS = [
	[/\bWindows NT\b/, 'Windows'],
	[/\biPad\b/, 'iPadOS'],
	[/\b(?:iPhone|iPod)\b/, 'iOS'],
	[/\bAndroid\b/, 'Android'],
	[/\bCrOS\b/, 'ChromeOS'],
	[/\b(?:Macintosh|Mac OS X)\b/, 'macOS'],
	[/\bLinux\b/, 'Linux'],
];

/** Планшет и телефон различаются только пометкой Mobile: у планшетов на Android её нет */
function deviceKind(value) {
	if (/\biPad\b/.test(value) || (/\bAndroid\b/.test(value) && !/\bMobile\b/.test(value))) {
		return 'tablet';
	}
	if (/\b(?:Mobile|iPhone|iPod|Android)\b/.test(value)) return 'mobile';
	return 'desktop';
}

function match(rules, value) {
	return rules.find(([pattern]) => pattern.test(value))?.[1] ?? '';
}

export function parseUserAgent(value) {
	if (!value) return { browser: '', os: '', kind: 'desktop' };

	return {
		browser: match(BROWSERS, value),
		os: match(SYSTEMS, value),
		kind: deviceKind(value),
	};
}
