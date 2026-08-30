## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Соглашения проекта

- Vue-код пишется на JavaScript: `<script setup>` без `lang="ts"`, композаблы и роутер — `.js`.
  TypeScript остаётся только в серверной части Astro (middleware, API-роуты, `src/lib/auth-server.ts`).
- Состояние — композаблы из `src/vue/composables`, стор не используем.
- Интерфейс собирается из shadcn-vue (`src/components/ui`) и Tailwind. Из `reka-ui` напрямую
  не импортируем ничего: нужного примитива нет в наборе — ставим готовый компонент
  `npx shadcn-vue@latest add <name>` и дальше правим уже его. Свои стили — только там, где
  подходящего компонента в shadcn-vue нет. Строки интерфейса живут в `src/vue/locales`.
  Осторожно: `shadcn-vue add` дописывает в начало `src/styles/global.css` импорт шрифта с
  Google Fonts — его нужно удалять, гарнитуру отдаёт `astro:assets` со своего домена.
- `/login`, `/register` и `/app/**` обслуживает одно SPA; Astro отдаёт для них общую оболочку
  `src/components/SpaRoot.astro`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
