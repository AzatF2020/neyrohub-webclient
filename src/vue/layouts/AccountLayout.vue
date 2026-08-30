<script setup>
import { Menu } from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import AccountNav from '../components/AccountNav.vue';
import ChatCreateDialog from '../components/ChatCreateDialog.vue';
import NavDrawer from '../components/NavDrawer.vue';
import Brand from '../components/Brand.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import { useChatCreate } from '../composables/useChatCreate';
import { useSession } from '../composables/useSession';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { refresh } = useSession();
const { isOpen: isCreateOpen } = useChatCreate();

const isMenuOpen = ref(false);

/** Чат сам распоряжается высотой: внешний скролл ему мешает */
const isFullHeight = computed(() => route.meta.fullHeight === true);
const shortcut = computed(() =>
	typeof navigator !== 'undefined' && navigator.platform?.startsWith('Mac') ? '⌘K' : 'Ctrl K',
);

/** От lg навигация стоит в сайдбаре — открывать её панелью поверх уже нечего */
const isCompact = useMediaQuery('(max-width: 63.99rem)');

function onKeydown(event) {
	if (!isCompact.value) return;
	if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;

	event.preventDefault();
	isMenuOpen.value = !isMenuOpen.value;
}

onMounted(() => {
	// Сессия могла быть отозвана между рендером оболочки и запуском скриптов;
	// заодно догружаем поля, которых нет в SSR-разметке (токен текущей сессии)
	void refresh();
	window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));

/** Выбрали модель — уводим на экран нового чата; сам чат появится с первым сообщением */
function startChat(model) {
	void router.push({ name: 'chat-new', query: { model } });
}

// Переход по ссылке закрывает меню
watch(() => route.fullPath, () => (isMenuOpen.value = false));
</script>

<template>
	<div class="flex h-svh overflow-hidden">
		<!--
			От lg навигация стоит на месте, и своей шапки кабинету уже не нужно: логотип,
			переключатель темы и разделы живут в сайдбаре. Ниже lg шапка остаётся — без неё
			выезжающую панель было бы нечем открыть.
		-->
		<aside class="hidden w-68 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
			<div class="flex h-14 shrink-0 items-center gap-2 px-4">
				<Brand />
				<ThemeToggle class="ml-auto" />
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
				<AccountNav />
			</div>
		</aside>

		<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
			<!-- Свечение начинается под шапкой; там, где её нет, — от самого верха -->
			<div
				class="glow pointer-events-none absolute inset-x-0 top-14 h-[28rem] lg:top-0"
				aria-hidden="true"
			/>

			<header
				class="relative shrink-0 border-b border-border bg-background px-4 lg:hidden"
			>
				<div class="mx-auto flex h-14 w-full max-w-5xl items-center gap-2">
					<Button variant="ghost" size="sm" class="-ml-2" @click="isMenuOpen = true">
						<Menu class="size-4" />
						<span class="hidden sm:inline">{{ t('common.menu') }}</span>
						<kbd
							class="hidden rounded border border-border px-1.5 font-sans text-[11px] text-muted-foreground md:inline"
						>
							{{ shortcut }}
						</kbd>
					</Button>

					<Brand class="mx-auto" />

					<ThemeToggle class="ml-auto" />
				</div>
			</header>

			<main
				class="relative min-h-0 flex-1"
				:class="isFullHeight ? 'overflow-hidden' : 'overflow-y-auto'"
			>
				<div
					class="mx-auto w-full max-w-5xl"
					:class="isFullHeight ? 'h-full' : 'px-4 py-8'"
				>
					<RouterView v-slot="{ Component }">
						<component :is="Component" />
					</RouterView>
				</div>
			</main>
		</div>

		<ChatCreateDialog
			v-model:open="isCreateOpen"
			:model-value="route.query.model ?? ''"
			@pick="startChat"
		/>

		<NavDrawer v-model:open="isMenuOpen">
			<AccountNav @navigate="isMenuOpen = false" />
		</NavDrawer>
	</div>
</template>
