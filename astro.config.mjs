// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import vue from '@astrojs/vue';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	// Всё рендерится на сервере по умолчанию; статические страницы помечаются `export const prerender = true`
	output: 'server',
	adapter: node({ mode: 'standalone' }),

	// Порт совпадает с trustedOrigins/FRONTEND_URL на бэкенде
	server: { port: 5173 },

	integrations: [vue()],

	// Шрифт отдаётся с нашего домена: без запроса к Google Fonts и без скачка при загрузке.
	// Переменная названа нейтрально — сменить гарнитуру можно правкой одного name.
	// Кириллица обязательна, интерфейс русский; styles только normal — курсива у Manrope нет,
	// и просить его значило бы качать файлы, которых не существует.
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Manrope',
			cssVariable: '--font-ui',
			weights: [400, 500, 600, 700],
			styles: ['normal'],
			subsets: ['latin', 'cyrillic'],
			fallbacks: ['system-ui', 'sans-serif'],
		},
	],

	vite: {
		plugins: [tailwindcss()],
		// Разметка ответов (markdown-it + katex + highlight.js) заведомо больше 500 кБ,
		// но грузится отдельным чанком и только под первый ответ модели
		build: { chunkSizeWarningLimit: 700 },
		// Тот же чанк лежит за динамическим import() в useMarkdown, поэтому сканер
		// зависимостей находит эти пакеты только при первом ответе модели — и уже на ходу
		// пересобирает их, отдавая на прежние адреса 504 (Outdated Optimize Dep).
		// Перечисляем их сами, чтобы сборка прошла до первого запроса из браузера.
		optimizeDeps: {
			include: ['markdown-it', '@vscode/markdown-it-katex', 'katex', 'highlight.js/lib/common'],
		},
	},

	// Сессиями заведует better-auth (Redis через secondaryStorage), встроенные сессии Astro не нужны
	session: false,

	env: {
		schema: {
			// Origin бэкенда с better-auth. Используется сервером Astro (прокси + чтение сессии в middleware)
			AUTH_ORIGIN: envField.string({
				context: 'server',
				access: 'secret',
				default: 'http://localhost:8080',
			}),
			// basePath из конфигурации betterAuth()
			AUTH_BASE_PATH: envField.string({
				context: 'server',
				access: 'secret',
				default: '/api/auth',
			}),
			// Пусто → браузер ходит на свой же origin, а Astro проксирует на бэкенд (рекомендуется).
			// Задайте, например, http://localhost:8080/api/auth, чтобы браузер ходил на бэкенд напрямую.
			PUBLIC_AUTH_BASE_URL: envField.string({
				context: 'client',
				access: 'public',
				optional: true,
			}),
			// База для прикладного API бэкенда (axios). По умолчанию — тот же origin
			PUBLIC_API_BASE_URL: envField.string({
				context: 'client',
				access: 'public',
				default: '/api',
			}),
			// Origin бэкенда с прикладным API. Сервер Astro проксирует туда /api/* (src/pages/api/[...path].ts)
			API_ORIGIN: envField.string({
				context: 'server',
				access: 'secret',
				default: 'http://localhost:8080',
			}),
			// Socket.IO живёт на том же порту, что и API. Пусто → свой origin (нужен прокси перед фронтом)
			PUBLIC_SOCKET_URL: envField.string({
				context: 'client',
				access: 'public',
				default: 'http://localhost:8080',
			}),
		},
	},
});
