<script setup>
import { ArrowLeft, MoreHorizontal, Repeat2, Sparkles, Trash2, WifiOff } from '@lucide/vue';
import { useElementSize } from '@vueuse/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiErrorText } from '@/lib/api';
import { isTextGeneration } from '@/lib/neurals';
import ChatComposer from '../components/ChatComposer.vue';
import ChatMessage from '../components/ChatMessage.vue';
import ChatReply from '../components/ChatReply.vue';
import ModelLogo from '../components/ModelLogo.vue';
import Preloader from '../components/Preloader.vue';
import MediaLightbox from '../components/MediaLightbox.vue';
import ChatStart from '../components/ChatStart.vue';
import { useChat } from '../composables/useChat';
import { useChatCreate } from '../composables/useChatCreate';
import { useChats } from '../composables/useChats';
import { useModels } from '../composables/useModels';
import { useSocket } from '../composables/useSocket';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const {
	chat,
	feed: messages,
	progress,
	isLoading,
	isLoadingMore,
	isSending,
	isStreaming,
	error,
	hasMore,
	open,
	adopt,
	close,
	loadOlder,
	send,
	stop,
} = useChat();
const { models, ensureLoaded: ensureModels, modelName, modelType } = useModels();
const { create, remove } = useChats();
const { open: openCreate } = useChatCreate();
const { isConnected } = useSocket();

/** Модель нового чата: после создания её уже не поменять — это поле самого чата */
const draftModel = ref('');
const isRemoving = ref(false);
const feed = ref(null);
const composer = ref(null);
const composerForm = ref(null);
const pageHeader = ref(null);
const feedContent = ref(null);
/** Пока человек у нижнего края, лента сама остаётся внизу: картинки грузятся и растягивают её */
const stickToBottom = ref(true);

// Шапка и композер вынуты из потока и лежат поверх ленты, поэтому её отступы меряем,
// а не задаём. border-box: иначе собственные отступы блоков не попадут в измерение.
const { height: composerHeight } = useElementSize(composer, undefined, {
	box: 'border-box',
});
const { height: headerHeight } = useElementSize(pageHeader, undefined, {
	box: 'border-box',
});
/** 12px — отступ шапки от верха (mt-3), остальное — воздух до первого сообщения */
const feedStyle = computed(() => ({
	paddingTop: `${headerHeight.value + 12 + 20}px`,
	paddingBottom: `${composerHeight.value + 16}px`,
}));

const { height: contentHeight } = useElementSize(feedContent, undefined, {
	box: 'border-box',
});

const isNew = computed(() => !route.params.id);
/**
 * Текстовый чат — другая таблица на бэкенде: реплики с ролями вместо генераций.
 * Он же ходит только своим стримом, поэтому сокет и его статусы ему ни к чему.
 */
const isChat = computed(() => isTextGeneration(chat.value?.type));
const activeModel = computed(() => chat.value?.model ?? draftModel.value);
const title = computed(() =>
	chat.value ? (chat.value.title ?? modelName(chat.value.model)) : t('chats.newTitle'),
);

/**
 * Куда возвращает «назад»: в раздел своего типа генерации. Разделы различаются только
 * query, поэтому без него вернулись бы в список без подсвеченного раздела — а без типа
 * списка и вовсе нет, роутер увёл бы на изображения.
 */
const section = computed(() => {
	const type = chat.value?.type ?? modelType(draftModel.value);
	return { name: 'chats', query: type ? { type } : undefined };
});

onMounted(async () => {
	await ensureModels();
	syncDraftModel();
});

/**
 * Модель нового чата приходит в адресе: её выбирают в диалоге создания, поэтому
 * ссылку на «новый чат с этой моделью» можно открыть напрямую. Адреса без модели
 * (обновили страницу, зашли по короткой ссылке) чинит тот же диалог.
 */
function syncDraftModel() {
	if (!isNew.value) return;

	const requested = route.query.model;
	if (models.value.some((model) => model.model === requested)) {
		draftModel.value = requested;
		return;
	}

	draftModel.value = '';
	if (models.value.length) openCreate();
}

watch([() => route.query.model, models], syncDraftModel);

onUnmounted(close);

watch(
	() => route.params.id,
	async (chatId) => {
		if (!chatId) {
			close();
			return;
		}
		// После создания чата он уже открыт — второй раз загружать нечего
		if (chat.value?.id === chatId) return;

		try {
			stickToBottom.value = true;
			await open(chatId);
			syncSection();
			await scrollToEnd();
		} catch (openError) {
			// Чужой или удалённый чат: бэкенд отвечает 403/404
			console.error('[chat] не удалось открыть чат:', openError);
			await router.replace({ name: 'chats' });
		}
	},
	{ immediate: true },
);

// Следим за последним сообщением, а не за длиной: иначе подгрузка старых утащит ленту вниз
watch(() => messages.value.at(-1)?.id, scrollToEnd);

// Лента дорастает после загрузки картинок — доводим её вниз, если человек оттуда не уходил
watch(contentHeight, () => {
	if (stickToBottom.value) void scrollToEnd();
});

/**
 * Раздел дописываем в адрес: зашли по прямой ссылке или обновили страницу — в query
 * его нет, и боковое меню не знает, какой раздел подсветить. Тип чата известен только
 * после загрузки, поэтому правим адрес здесь, replace — чтобы не плодить историю.
 */
function syncSection() {
	const type = chat.value?.type;
	if (!type || route.query.type === type) return;

	void router.replace({ name: 'chat', params: { id: chat.value.id }, query: { type } });
}

async function scrollToEnd() {
	await nextTick();
	if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
}

function onFeedScroll() {
	const el = feed.value;
	if (!el) return;

	stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

/** Подгружает старые сообщения, оставляя на месте то, что человек читает */
async function showOlder() {
	const el = feed.value;
	const heightBefore = el?.scrollHeight ?? 0;

	await loadOlder();
	await nextTick();

	if (el) el.scrollTop += el.scrollHeight - heightBefore;
}

/** Готовый запрос с экрана нового чата: композер сам решает, что с ним делать */
function fillPrompt(text) {
	composerForm.value?.fill(text);
}

async function submit(options) {
	error.value = '';

	try {
		if (isNew.value) {
			const model = models.value.find((item) => item.model === draftModel.value);
			if (!model) return;

			const chatId = await create({ type: model.type, model: model.model });
			// Свежесозданный чат забираем как есть: перечитывать с сервера нечего, он пуст
			adopt({ id: chatId, type: model.type, model: model.model });

			/*
			 * Переход не ждём, а отправляем в том же кадре: адрес нужен на случай перезагрузки,
			 * но пока навигация идёт, лента уже не пуста — в ней стоит черновик запроса, который
			 * send рисует синхронно. Иначе между сменой адреса и отправкой мелькало «Пока пусто».
			 */
			void router.replace({
				name: 'chat',
				params: { id: chatId },
				query: { type: model.type },
			});
			await send(options);
			return;
		}

		await send(options);
	} catch (requestError) {
		// Композабл уже мог положить сюда текст бэкенда — общей фразой перекрываем только пустое
		error.value ||= apiErrorText(requestError) ?? t('errors.generic');
	}
}

async function confirmRemove() {
	const chatId = chat.value?.id;
	if (!chatId) return;

	try {
		const target = section.value;
		await remove(chatId);
		await router.push(target);
	} catch (requestError) {
		error.value = apiErrorText(requestError) ?? t('errors.generic');
	}
}
</script>

<template>
	<section class="relative flex h-full flex-col">
		<!--
			Шапка не в потоке, а поверх ленты: лента уходит под неё и размывается стеклом,
			поэтому шапка не съезжает при прокрутке. absolute, а не fixed: fixed считается
			от окна и на десктопе накрыл бы сайдбар, а тут секция — своя система координат.
			Строка одна — удаление ушло в меню, иначе плашка становилась тесной.
		-->
		<header
			ref="pageHeader"
			class="absolute inset-x-0 top-0 z-10 mx-4 mt-3 flex h-14 items-center gap-3 rounded-xl border border-border bg-background/80 px-2.5 supports-backdrop-filter:backdrop-blur-sm"
		>
			<Button variant="ghost" size="icon" as-child class="size-9 shrink-0">
				<RouterLink :to="section" :aria-label="t('chats.title')">
					<ArrowLeft class="size-4.5" />
				</RouterLink>
			</Button>

			<ModelLogo :model="activeModel" class="size-8" />

			<h1 class="min-w-0 flex-1 truncate text-md font-bold tracking-tight">{{ title }}</h1>

			<!-- Модель меняется только до создания: дальше она поле самого чата и его записей -->
			<Button v-if="isNew" variant="outline" size="sm" class="shrink-0" @click="openCreate">
				<Repeat2 class="size-4" />
				{{ t('chats.changeModel') }}
			</Button>

			<!-- Обрыв сокета прятать нельзя: значок и нужен ровно тогда, когда он виден -->
			<Badge
				v-if="chat && !isChat && !isConnected"
				variant="secondary"
				:title="t('chats.offline')"
				class="shrink-0"
			>
				<WifiOff class="size-3.5" />
			</Badge>

			<DropdownMenu v-if="chat">
				<DropdownMenuTrigger as-child>
					<Button
						variant="ghost"
						size="icon"
						:aria-label="t('chats.menu')"
						class="size-9 shrink-0 text-muted-foreground"
					>
						<MoreHorizontal class="size-4.5" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end">
					<DropdownMenuItem variant="destructive" @select="isRemoving = true">
						<Trash2 class="size-4" />
						{{ t('chats.delete') }}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>

		<div
			ref="feed"
			class="min-h-0 flex-1 overflow-y-auto px-4"
			:style="feedStyle"
			@scroll.passive="onFeedScroll"
		>
			<!-- Пустой чат центрирует логотип, поэтому в этом случае растягиваем обёртку на всю ленту -->
			<div ref="feedContent" :class="isNew && 'flex min-h-full flex-col'">
				<div v-if="hasMore" class="mb-8 flex justify-center">
					<Button variant="outline" size="sm" :disabled="isLoadingMore" @click="showOlder">
						{{ isLoadingMore ? t('common.loading') : t('chats.loadMore') }}
					</Button>
				</div>

				<Preloader v-if="isLoading" />

				<!-- Новый чат: вместо пустой ленты выбор задачи и затравки для поля ввода -->
				<ChatStart v-else-if="isNew" :model="draftModel" @pick="fillPrompt" />

				<div v-else-if="!messages.length" class="grid justify-items-center gap-2 py-20 text-center">
					<Sparkles class="size-6 text-muted-foreground" />
					<p class="text-sm text-muted-foreground">
						{{ t('chats.noMessages') }}
					</p>
				</div>

				<!-- В переписке реплики стоят вплотную, пары отделяет отступ запроса; у генераций обмен целиком в одной записи -->
				<div v-else class="grid" :class="isChat ? 'gap-3' : 'gap-8'">
					<template v-for="message in messages" :key="message.id">
						<ChatReply v-if="isChat" :message="message" :model="chat?.model" />
						<ChatMessage
							v-else
							:message="message"
							:type="chat?.type"
							:model="chat?.model"
							:progress="progress[message.taskId] ?? null"
						/>
					</template>
				</div>
			</div>
		</div>

		<div
			ref="composer"
			class="absolute inset-x-0 bottom-0 z-10 grid gap-3 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pt-6 pb-4"
		>
			<Alert v-if="error" variant="destructive">
				<AlertDescription>{{ error }}</AlertDescription>
			</Alert>

			<ChatComposer
				ref="composerForm"
				:model="activeModel"
				:disabled="isLoading || !activeModel"
				:sending="isSending"
				:streaming="isStreaming"
				@submit="submit"
				@stop="stop"
			/>
		</div>

		<MediaLightbox />

		<AlertDialog v-model:open="isRemoving">
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{{ t('chats.deleteTitle') }}</AlertDialogTitle>
					<AlertDialogDescription>{{ t('chats.deleteText') }}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
					<AlertDialogAction variant="destructive" @click="confirmRemove">
						{{ t('common.delete') }}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	</section>
</template>
