<script setup>
import { TriangleAlert, X } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Одно вложение композера: файл в пути, готовый файл или вставленная ссылка */
const props = defineProps({
	item: { type: Object, required: true },
});

const emit = defineEmits(['remove', 'retry', 'open']);

const { t } = useI18n();

const isUploading = computed(() => props.item.status === 'uploading');
const isFailed = computed(() => props.item.status === 'failed');
/** Байты ушли, но файл ещё подтверждается: процентов больше не будет, а ждать ещё есть чего */
const isFinishing = computed(() => isUploading.value && props.item.progress >= 100);

function activate() {
	emit(isFailed.value ? 'retry' : 'open');
}
</script>

<template>
	<div class="relative">
		<!-- Сломанное вложение открывать нечего: клик по нему повторяет загрузку -->
		<button
			type="button"
			class="block size-14 overflow-hidden rounded-lg border"
			:class="isFailed ? 'border-destructive/50' : 'cursor-zoom-in border-border'"
			:title="isFailed ? item.error : item.name"
			:aria-label="isFailed ? t('files.retry') : t('chats.openOriginal')"
			@click="activate"
		>
			<!-- Ролик показывает первый кадр: проигрывать его тут негде, а узнать файл надо -->
			<video
				v-if="item.isVideo"
				:src="item.preview"
				muted
				playsinline
				preload="metadata"
				class="pointer-events-none size-full object-cover"
			/>
			<img v-else :src="item.preview" alt="" class="size-full object-cover" />
		</button>

		<div
			v-if="isUploading"
			class="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-background/75 text-xs font-semibold tabular-nums"
		>
			<Spinner v-if="isFinishing" class="text-muted-foreground" />
			<template v-else>{{ item.progress }}%</template>
		</div>

		<div
			v-else-if="isFailed"
			class="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-destructive/15"
		>
			<TriangleAlert class="size-4 text-destructive" />
		</div>

		<Button
			type="button"
			variant="secondary"
			size="icon"
			class="absolute -top-1.5 -right-1.5 size-5 rounded-full"
			:aria-label="t('chats.attachRemove')"
			@click="emit('remove')"
		>
			<X class="size-3" />
		</Button>
	</div>
</template>
