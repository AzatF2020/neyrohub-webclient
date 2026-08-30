const STORAGE_KEY = 'theme';

function prefersDark() {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readTheme() {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function applyTheme(theme) {
	const isDark = theme === 'dark' || (theme !== 'light' && prefersDark());
	document.documentElement.classList.toggle('dark', isDark);
	return isDark ? 'dark' : 'light';
}

export function setTheme(theme) {
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		/* приватный режим — тема просто не запомнится */
	}
	return applyTheme(theme);
}

export function currentTheme() {
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
