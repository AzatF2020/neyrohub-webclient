<script setup>
import { ImageOff } from '@lucide/vue';
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileLinks } from '../composables/useFileLinks';
import { useLightbox } from '../composables/useLightbox';

/**
 * Файлы, приложенные к запросу. В самом запросе они остались ссылками — модели принимают
 * в options ссылки, — а живёт ссылка час: протухшую меняем на свежую, когда знаем, какому
 * файлу она принадлежит. Файлы, загруженные из этого браузера, мы помним (`src/lib/files.js`);
 * для чужих остаётся заглушка.
 */
const props = defineProps({
	/** Вложения в виде { url, isVideo } — их собирает readAttachments по схеме модели */
	items: { type: Array, default: () => [] },
	/** Промпт запроса: он же подпись в просмотрщике и alt картинки */
	caption: { type: String, default: '' },
});

const { t } = useI18n();
const { open } = useLightbox();
const { refreshLink } = useFileLinks();

/** Исходная ссылка → та, по которой файл показываем сейчас */
const live = reactive({});
const broken = reactive({});

function src(item) {
	return live[item.url] || item.url;
}

async function onError(item) {
	// За свежей ссылкой ходим один раз: если и она не открылась, дело не в сроке
	if (item.url in live) {
		broken[item.url] = true;
		return;
	}

	live[item.url] = await refreshLink(item.url);
	if (!live[item.url]) broken[item.url] = true;
}
</script>

<template>
	<div v-if="items.length" class="flex flex-wrap justify-end gap-1.5">
		<template v-for="item in items" :key="item.url">
			<!-- Файла больше нет: срок хранения тридцать дней, и он мог выйти -->
			<div
				v-if="broken[item.url]"
				class="grid size-16 place-items-center rounded-lg border border-border bg-muted"
				:title="t('files.unavailable')"
			>
				<ImageOff class="size-4 text-muted-foreground" />
			</div>

			<button
				v-else
				type="button"
				class="cursor-zoom-in"
				@click="open(src(item), caption, { video: item.isVideo })"
			>
				<!-- Референсный ролик показывает первый кадр; смотреть его — в просмотрщике -->
				<video
					v-if="item.isVideo"
					:src="src(item)"
					muted
					playsinline
					preload="metadata"
					class="pointer-events-none size-16 rounded-lg border border-border object-cover"
					@error="onError(item)"
				/>
				<img
					v-else
					:src="src(item)"
					:alt="caption"
					loading="lazy"
					class="size-16 rounded-lg border border-border object-cover"
					@error="onError(item)"
				/>
			</button>
		</template>
	</div>
</template>
