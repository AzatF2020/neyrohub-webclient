<script setup>
import { Sparkles, Trash2 } from '@lucide/vue';
import { useElementSize } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fromNow } from '@/lib/datetime';
import {
	GenerationType,
	MessageRole,
	TaskStatus,
	isPending,
	isTextGeneration,
	readOutput,
} from '@/lib/neurals';
import { toPlainText } from '@/lib/plain-text';
import { useMediaLinks } from '../composables/useFileLinks';
import { useMarkdown } from '../composables/useMarkdown';
import { useModels } from '../composables/useModels';
import ModelLogo from './ModelLogo.vue';

/**
 * Докуда показываем реплику в карточке. Обрезаем по высоте, а не по числу строк:
 * в разметке строки разной высоты — заголовок, блок кода и формула считаются
 * за одну, и карточки разъезжались бы на глаз.
 */
const PREVIEW_HEIGHT = 240;

const props = defineProps({ chat: { type: Object, required: true } });

const emit = defineEmits(['remove']);

const { t } = useI18n();
const { modelName } = useModels();
const { isReady: isMarkdownReady, ensureLoaded: ensureMarkdown, toHtml } = useMarkdown();

const last = computed(() => props.chat.lastMessage ?? null);
const result = computed(() => readOutput(last.value?.output));

/**
 * Обложка чата — первый результат последней генерации. В `output` лежит идентификатор
 * файла или ссылка провайдера; за ссылкой на файл сходит useMediaLinks, остальные
 * результаты плитке не нужны — их она и не спрашивает.
 */
const { urls: coverUrls } = useMediaLinks(() => result.value.items.slice(0, 1));
const cover = computed(() => coverUrls.value[0] ?? '');
const isVideo = computed(() => props.chat.type === GenerationType.Videos);
/** У переписки обложки нет: её место занимает последняя реплика */
const isChat = computed(() => isTextGeneration(props.chat.type));

/**
 * Обложка показывается в тех пропорциях, что просили у модели: квадрат резал
 * вертикальные кадры и добавлял пустоту к горизонтальным. Соотношение лежит
 * в запросе последнего сообщения; без него остаётся квадрат.
 */
const ratio = computed(() => {
	const value = last.value?.input?.aspect_ratio;
	return typeof value === 'string' && value.includes(':') ? value.replace(':', ' / ') : '1 / 1';
});

/** Сырая реплика: разметку рисуем как есть, метки снимаются только там, где рисовать нечем */
const raw = computed(() => last.value?.content || result.value.text || '');

/** Подпись под карточкой и alt обложки: там разметке места нет */
const content = computed(() => toPlainText(last.value?.content));

/** Подпись чата: у реплики переписки это её текст, у генерации — промпт запроса */
const preview = computed(() => content.value || last.value?.input?.prompt || t('chats.emptyChat'));

const text = computed(() => toPlainText(raw.value));

/**
 * Ответ модели приходит разметкой — в карточке рисуем его тем же renderMarkdown, что и
 * в самом чате: заголовки, списки, код и формулы. Свой запрос человек писал текстом,
 * и в переписке он тоже не размечается — здесь так же.
 */
const isAnswer = computed(() => last.value?.role === MessageRole.Assistant);
const html = computed(() => (isChat.value && isAnswer.value ? toHtml(raw.value) : ''));

// Тяжёлый модуль разметки нужен только переписке с ответом: плитке генераций он ни к чему
watch(
	[isChat, isAnswer],
	() => {
		if (isChat.value && isAnswer.value) void ensureMarkdown();
	},
	{ immediate: true },
);

/** Реплика не поместилась: обрыв нужно растворить, иначе он читается как ошибка */
const body = ref(null);
const { height: bodyHeight } = useElementSize(body);
const isClipped = computed(() => bodyHeight.value > PREVIEW_HEIGHT);
const pending = computed(() => Boolean(last.value) && isPending(last.value.status));
// Ссылки на результат живут не вечно: протухшую обложку заменяем заглушкой
const isCoverBroken = ref(false);
const hasCover = computed(() => Boolean(cover.value) && !isCoverBroken.value);

watch(cover, () => (isCoverBroken.value = false));
const failed = computed(() => last.value?.status === TaskStatus.Failed);

/**
 * У переписки под карточкой не сам текст — он уже занимает всю карточку, —
 * а чья это реплика и чем закончилась.
 */
const caption = computed(() => {
	if (pending.value) return t('chats.thinking');
	if (failed.value) return t('chats.status.failed');
	if (!last.value) return t('chats.emptyChat');

	return t(last.value.role === MessageRole.Assistant ? 'chats.lastAnswer' : 'chats.lastQuestion');
});

/** Время последней реплики: возраст самого чата в переписке ни о чём не говорит */
const changedAt = computed(() => last.value?.createdAt ?? props.chat.createdAt);
</script>

<template>
	<!-- Плитку раскладывают колонки CSS, поэтому карточка не должна разрываться между ними -->
	<div class="group relative mb-4 break-inside-avoid">
		<RouterLink :to="{ name: 'chat', params: { id: chat.id } }" class="block">
			<!-- Переписка: последняя реплика вместо обложки, высота — по тексту -->
			<div
				v-if="isChat"
				class="grid gap-3 rounded-xl border border-border bg-muted p-4 transition-colors group-hover:border-primary/40"
			>
				<div
					v-if="text"
					class="relative overflow-hidden"
					:style="{ maxHeight: `${PREVIEW_HEIGHT}px` }"
				>
					<div ref="body">
						<!--
							Разметка не кликается: карточка целиком — ссылка на чат, и ссылки внутри
							ответа уводили бы из неё. В v-html идёт только сборка renderMarkdown.
						-->
						<div
							v-if="isMarkdownReady && html"
							class="pointer-events-none markdown prose prose-sm dark:prose-invert"
							v-html="html"
						/>
						<!-- Модуль разметки ещё в пути или это запрос человека: текст важнее оформления -->
						<p v-else class="text-sm whitespace-pre-line">{{ text }}</p>
					</div>

					<div
						v-if="isClipped"
						class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted to-transparent"
						aria-hidden="true"
					/>
				</div>
				<p v-else class="text-sm text-muted-foreground">{{ t('chats.emptyChat') }}</p>
			</div>

			<div
				v-else
				class="relative overflow-hidden rounded-xl border border-border bg-muted transition-colors group-hover:border-primary/40"
				:style="{ aspectRatio: ratio }"
			>
				<video
					v-if="hasCover && isVideo"
					:src="cover"
					muted
					playsinline
					preload="metadata"
					class="size-full object-cover"
				/>
				<img
					v-else-if="hasCover"
					:src="cover"
					:alt="preview"
					loading="lazy"
					class="size-full object-cover"
					@error="isCoverBroken = true"
				/>
				<div v-else class="flex size-full items-center justify-center">
					<Sparkles class="size-6 text-muted-foreground" :class="pending && 'animate-pulse'" />
				</div>

				<Badge
					v-if="pending"
					variant="secondary"
					class="absolute top-2 left-2 bg-background/70 supports-backdrop-filter:backdrop-blur-xs"
				>
					{{ t(`chats.status.${last.status}`) }}
				</Badge>
				<Badge v-else-if="failed" variant="destructive" class="absolute top-2 left-2">
					{{ t('chats.status.failed') }}
				</Badge>
			</div>

			<!-- Подпись живёт под карточкой, а не внутри: так плитка читается как галерея -->
			<div class="grid gap-0.5 px-1 pt-2">
				<p class="line-clamp-1 text-sm font-medium" :class="isChat && 'text-muted-foreground'">
					{{ isChat ? caption : preview }}
				</p>
				<!-- Значок модели у её же имени: в плитке одного раздела чаты различает именно модель -->
				<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<ModelLogo :model="chat.model" class="size-4" />
					<span class="min-w-0 truncate">
						{{ modelName(chat.model) }} · {{ fromNow(changedAt) }}
					</span>
				</p>
			</div>
		</RouterLink>

		<!-- Удаление не мозолит глаза: появляется на наведении и при переходе с клавиатуры -->
		<Button
			variant="secondary"
			size="icon"
			class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
			:aria-label="t('chats.delete')"
			@click="emit('remove')"
		>
			<Trash2 class="size-4" />
		</Button>
	</div>
</template>
