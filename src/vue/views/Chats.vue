<script setup>
import { Bot, Film, Image as ImageIcon, MessageSquarePlus } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
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
import { Button } from '@/components/ui/button';
import { apiErrorText } from '@/lib/api';
import { CHAT_TYPES, GenerationType } from '@/lib/neurals';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatCard from '../components/ChatCard.vue';
import Preloader from '../components/Preloader.vue';
import { useChatCreate } from '../composables/useChatCreate';
import { useChats } from '../composables/useChats';
import { useModels } from '../composables/useModels';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { chats, isLoading, ensureLoaded, remove } = useChats();
const { open: openCreate } = useChatCreate();
const { ensureLoaded: ensureModels } = useModels();

/** Значок раздела: он же стоит во вкладке и в боковом меню */
const SECTION_ICONS = {
	[GenerationType.Images]: ImageIcon,
	[GenerationType.Videos]: Film,
	[GenerationType.Text]: Bot,
};

/**
 * Раздел задаётся в адресе и уходит в запрос списка: бэкенд отдаёт чаты только этого
 * типа. Адреса без раздела не бывает — роутер уводит с него на изображения.
 */
const type = computed(() => route.query.type ?? '');

const pageTitle = computed(() => t(`chats.sections.${type.value}`));
const pageSubtitle = computed(() => t(`chats.sectionSubtitles.${type.value}`));

/** Список свой у каждой вкладки: переключились — грузим её, если ещё не грузили */
watch(
	type,
	(value) => {
		if (value) void ensureLoaded(value);
	},
	{ immediate: true },
);

function openSection(next) {
	if (next !== type.value) void router.push({ name: 'chats', query: { type: next } });
}

// Чат храним отдельно от состояния диалога: reka-ui закрывает его раньше нашего обработчика
const removingId = ref(null);
const isRemoveOpen = ref(false);
const removeError = ref('');

onMounted(() => void ensureModels());

function askRemove(chatId) {
	removingId.value = chatId;
	isRemoveOpen.value = true;
}

async function confirmRemove() {
	const chatId = removingId.value;
	if (!chatId) return;

	removeError.value = '';
	try {
		await remove(chatId);
	} catch (requestError) {
		removeError.value = apiErrorText(requestError) ?? t('errors.generic');
	}
	removingId.value = null;
}
</script>

<template>
	<section class="grid gap-6">
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div class="grid gap-1">
				<h1 class="text-2xl font-semibold tracking-tight">{{ pageTitle }}</h1>
				<p class="text-sm text-muted-foreground">{{ pageSubtitle }}</p>
			</div>

			<Button size="sm" @click="openCreate(type)">
				<MessageSquarePlus class="size-4" />
				{{ t('chats.new') }}
			</Button>
		</header>

		<!--
			Переключатель разделов на самой странице: боковое меню ведёт сюда же, но ниже lg
			оно спрятано за кнопкой меню, а вкладки стоят прямо над списком, который меняют.
		-->
		<Tabs :model-value="type" @update:model-value="openSection">
			<TabsList class="w-full">
				<TabsTrigger v-for="item in CHAT_TYPES" :key="item" :value="item">
					<component :is="SECTION_ICONS[item]" />
					{{ t(`chats.sections.${item}`) }}
				</TabsTrigger>
			</TabsList>
		</Tabs>

		<Alert v-if="removeError" variant="destructive">
			<AlertDescription>{{ removeError }}</AlertDescription>
		</Alert>

		<Preloader v-if="isLoading && !chats.length" />

		<Card v-else-if="!chats.length">
			<CardContent class="grid justify-items-start gap-3 py-8 text-sm text-muted-foreground">
				{{ t('chats.empty') }}
				<Button size="sm" variant="secondary" @click="openCreate(type)">{{ t('chats.new') }}</Button>
			</CardContent>
		</Card>

		<!--
			Галерея: обложки идут в своих пропорциях, поэтому высота карточек разная.
			Колонки CSS — единственная раскладка, которая это укладывает без замеров;
			цена — порядок по колонкам, а не по строкам, но для плитки это незаметно.
		-->
		<div v-else class="columns-1 gap-4 sm:columns-2 lg:columns-3">
			<ChatCard
				v-for="chat in chats"
				:key="chat.id"
				:chat="chat"
				@remove="askRemove(chat.id)"
			/>
		</div>

		<AlertDialog v-model:open="isRemoveOpen">
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
