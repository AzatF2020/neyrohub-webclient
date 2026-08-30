<script setup>
import { TriangleAlert } from '@lucide/vue';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatTime } from '@/lib/datetime';
import { MessageRole, TaskStatus, isPending } from '@/lib/neurals';
import { useLightbox } from '../composables/useLightbox';
import { useMarkdown } from '../composables/useMarkdown';
import { useMessageParams } from '../composables/useMessageParams';
import { useModels } from '../composables/useModels';

/** Одна реплика текстового чата: запись chat_messages с ролью и текстом */
const props = defineProps({
	message: { type: Object, required: true },
	model: { type: String, default: '' },
});

const { t } = useI18n();
const { open } = useLightbox();
const { modelOptions } = useModels();
const { isReady: isMarkdownReady, ensureLoaded: ensureMarkdown, toHtml } = useMarkdown();
const { summary, hint } = useMessageParams(
	() => props.model,
	() => props.message.params,
);

const isUser = computed(() => props.message.role !== MessageRole.Assistant);
const text = computed(() => props.message.content ?? '');
const pending = computed(() => isPending(props.message.status));
const failed = computed(() => props.message.status === TaskStatus.Failed);
/** Ответ пришёл не целиком: текст уже идёт, но модель ещё пишет */
const isWriting = computed(() => pending.value && Boolean(text.value));

/**
 * Модель отвечает разметкой, поэтому ответ рисуем как markdown. Пересобирается
 * на каждый кусок стрима — посреди ответа разметка ещё не закрыта, и это нормально.
 * В `v-html` уходит только то, что собрал renderMarkdown: теги из самого ответа
 * он экранирует, а не исполняет.
 */
const html = computed(() => (isUser.value ? '' : toHtml(text.value)));

// Свои реплики разметкой не рисуем — ради них тянуть модуль незачем
onMounted(() => {
	if (!isUser.value) void ensureMarkdown();
});

/** Приложенные к запросу изображения: как называется поле, известно из схемы модели */
const attachments = computed(() => {
	const field = modelOptions(props.model).find((item) => item.type === 'image_list');
	return (field && props.message.params?.[field.name]) || [];
});

/** Расход токенов интересен редко — держим его в подсказке к ответу */
const usage = computed(() => {
	const tokens = props.message.usage;
	if (!tokens) return '';

	return Object.entries(tokens)
		.map(([name, value]) => `${name}: ${value}`)
		.join('\n');
});
</script>

<template>
	<!-- Запрос человека -->
	<article v-if="isUser" class="mt-5 flex justify-end first:mt-0">
		<div class="bubble-width grid justify-items-end gap-1.5">
			<div v-if="attachments.length" class="flex flex-wrap justify-end gap-1.5">
				<button
					v-for="image in attachments"
					:key="image"
					type="button"
					class="cursor-zoom-in"
					@click="open(image, text)"
				>
					<img
						:src="image"
						:alt="text"
						loading="lazy"
						class="size-16 rounded-lg border border-border object-cover"
					/>
				</button>
			</div>

			<p
				v-if="text"
				class="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground"
			>
				{{ text }}
			</p>
			<p class="text-xs text-muted-foreground" :title="hint">
				<template v-if="summary">{{ summary }} · </template>
				{{ formatTime(message.createdAt) }}
			</p>
		</div>
	</article>

	<!-- Ответ модели -->
	<article v-else class="bubble-width grid justify-items-start gap-2">
		<div v-if="text" class="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5" :title="usage">
			<div
				v-if="isMarkdownReady"
				class="markdown prose prose-sm dark:prose-invert"
				:class="isWriting && 'markdown-writing'"
				v-html="html"
			/>
			<!-- Модуль разметки ещё в пути: текст важнее оформления -->
			<p v-else class="text-sm whitespace-pre-wrap">{{ text }}</p>
		</div>

		<!-- Ждать, кроме самого текста, тут нечего: места под результат у ответа нет -->
		<p v-else-if="pending" class="animate-pulse px-1 text-sm text-muted-foreground">
			{{ t('chats.thinking') }}
		</p>

		<!-- Оборванный стрим оставляет и текст, и причину: тогда причина — сноска, а не вся неудача -->
		<p v-if="failed && text" class="px-1 text-xs text-muted-foreground">
			{{ message.errorReason || t('chats.failedFallback') }}
		</p>
		<div
			v-else-if="failed"
			class="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
		>
			<TriangleAlert class="mt-0.5 size-4 shrink-0" />
			<p>{{ message.errorReason || t('chats.failedFallback') }}</p>
		</div>

		<p v-else-if="!pending && !text" class="text-sm text-muted-foreground">
			{{ t('chats.emptyResult') }}
		</p>
	</article>
</template>
