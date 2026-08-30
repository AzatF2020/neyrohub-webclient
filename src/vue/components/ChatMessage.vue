<script setup>
import { TriangleAlert } from '@lucide/vue';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/datetime';
import { GenerationType, TaskStatus, isPending, readOutput } from '@/lib/neurals';
import { useLightbox } from '../composables/useLightbox';
import { useMarkdown } from '../composables/useMarkdown';
import { useMessageParams } from '../composables/useMessageParams';
import { useModels } from '../composables/useModels';
import ResultMedia from './ResultMedia.vue';

/** Одна генерация: запрос и её результат — это одна запись в messages */
const props = defineProps({
	message: { type: Object, required: true },
	type: { type: String, default: GenerationType.Images },
	model: { type: String, default: '' },
	progress: { type: Number, default: null },
});

const { t } = useI18n();
const { open } = useLightbox();
const { modelOptions } = useModels();
const { isReady: isMarkdownReady, ensureLoaded: ensureMarkdown, toHtml } = useMarkdown();
const { summary, hint } = useMessageParams(
	() => props.model,
	() => props.message.input,
);

const result = computed(() => readOutput(props.message.output));
const pending = computed(() => isPending(props.message.status));
const failed = computed(() => props.message.status === TaskStatus.Failed);
const isVideo = computed(() => props.type === GenerationType.Videos);

const prompt = computed(() => props.message.input?.prompt ?? '');

/** Приложенные к запросу изображения: как называется поле, известно из схемы модели */
const attachments = computed(() => {
	const field = modelOptions(props.model).find((item) => item.type === 'image_list');
	return (field && props.message.input?.[field.name]) || [];
});

/** Место под результат держим в тех же пропорциях, что запросили — иначе лента дёргается */
const ratio = computed(() => {
	const value = props.message.input?.aspect_ratio;
	return typeof value === 'string' && value.includes(':') ? value.replace(':', ' / ') : '1 / 1';
});

/** kie.ai отдаёт прогресс долей единицы; целые числа трактуем как проценты */
const percent = computed(() => {
	if (props.progress === null) return null;
	return Math.round(props.progress > 1 ? props.progress : props.progress * 100);
});

// Текстовый ответ у генерации — редкость, поэтому модуль разметки просим только под него
watch(() => result.value.text, (text) => text && void ensureMarkdown(), { immediate: true });
</script>

<template>
	<article class="grid gap-3">
		<div class="flex justify-end">
			<div class="bubble-width grid justify-items-end gap-1.5">
				<div v-if="attachments.length" class="flex flex-wrap justify-end gap-1.5">
					<button
						v-for="image in attachments"
						:key="image"
						type="button"
						class="cursor-zoom-in"
						@click="open(image, prompt)"
					>
						<img
							:src="image"
							:alt="prompt"
							loading="lazy"
							class="size-16 rounded-lg border border-border object-cover"
						/>
					</button>
				</div>

				<!-- Промпт бывает пустым: для image-to-video хватает и одних вложений -->
				<p
					v-if="prompt"
					class="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground"
				>
					{{ prompt }}
				</p>
				<p class="text-xs text-muted-foreground" :title="hint">
					<template v-if="summary">{{ summary }} · </template>
					{{ formatTime(message.createdAt) }}
				</p>
			</div>
		</div>

		<div class="max-w-[85%]">
			<div v-if="pending" class="grid gap-2">
				<Skeleton class="w-full max-w-64 rounded-xl" :style="{ aspectRatio: ratio }" />
				<p class="text-xs text-muted-foreground">
					{{ t(`chats.status.${message.status}`) }}
					<template v-if="percent !== null"> · {{ percent }}%</template>
				</p>
			</div>

			<div
				v-else-if="failed"
				class="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			>
				<TriangleAlert class="mt-0.5 size-4 shrink-0" />
				<p>{{ message.errorReason || t('chats.failedFallback') }}</p>
			</div>

			<!-- Текстовый ответ в output остался у записей старого формата — разметку в нём тоже рисуем -->
			<div v-else-if="result.text" class="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
				<div
					v-if="isMarkdownReady"
					class="markdown prose prose-sm dark:prose-invert"
					v-html="toHtml(result.text)"
				/>
				<p v-else class="text-sm whitespace-pre-wrap">{{ result.text }}</p>
			</div>

			<div v-else-if="result.urls.length" class="flex flex-wrap gap-2">
				<ResultMedia
					v-for="url in result.urls"
					:key="url"
					:src="url"
					:video="isVideo"
					:alt="prompt"
					@open="open(url, prompt)"
				/>
			</div>

			<p v-else class="text-sm text-muted-foreground">{{ t('chats.emptyResult') }}</p>
		</div>
	</article>
</template>
