<script setup>
import { ChevronRight, Film, Image as ImageIcon, MessageSquare, Search } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GenerationType } from '@/lib/neurals';
import { cn } from '@/lib/utils';
import ModelLogo from './ModelLogo.vue';
import { useChatCreate } from '../composables/useChatCreate';
import { useModelSearch } from '../composables/useModelSearch';
import { useModels } from '../composables/useModels';

/**
 * Выбор режима и модели для нового чата. Чат создаётся не здесь: диалог только
 * отдаёт слаг наружу, а запись появляется вместе с первым сообщением — иначе
 * каждое открытие диалога плодило бы пустые чаты.
 */
const props = defineProps({
	open: { type: Boolean, default: false },
	/** Уже выбранная модель: по ней открывается нужная вкладка */
	modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:open', 'pick']);

const { t } = useI18n();
const { models } = useModels();
const { preferredType } = useChatCreate();
const { query, needle, results, isFailed, reset } = useModelSearch();

/** Порядок вкладок задан руками: справочник приходит в порядке бэкенда */
const MODES = [
	{ type: GenerationType.Text, icon: MessageSquare },
	{ type: GenerationType.Images, icon: ImageIcon },
	{ type: GenerationType.Videos, icon: Film },
];

const activeType = ref(MODES[0].type);
const searchField = ref(null);

const isOpen = computed({
	get: () => props.open,
	set: (next) => emit('update:open', next),
});

const activeIndex = computed(() => {
	const index = MODES.findIndex((mode) => mode.type === activeType.value);
	return index === -1 ? 0 : index;
});

/**
 * Бегунок под активной вкладкой. Колонки равной ширины, поэтому его положение —
 * это ровно номер вкладки в его собственных ширинах: ничего мерить не нужно,
 * а сдвиг анимируется одним transform.
 */
const thumbStyle = computed(() => ({
	width: `calc((100% - 0.5rem) / ${MODES.length})`,
	transform: `translateX(${activeIndex.value * 100}%)`,
}));

/** Ищет бэкенд, а по режимам список бьют вкладки: тип приходит вместе с моделью */
const found = computed(() => results.value.filter((model) => model.type === activeType.value));

/** Совпадения в других режимах: без подсказки пустая вкладка выглядит как «ничего не нашлось» */
const elsewhere = computed(() =>
	needle.value ? results.value.length - found.value.length : 0,
);

/**
 * Открыли заново — поиск чистый, а вкладка та, откуда позвали: раздел бокового меню
 * называет режим прямо, иначе берём режим уже выбранной модели.
 */
watch(isOpen, async (opened) => {
	if (!opened) return;

	reset();
	const current = models.value.find((model) => model.model === props.modelValue);
	const wanted = preferredType.value || current?.type;
	if (MODES.some((mode) => mode.type === wanted)) activeType.value = wanted;

	await nextTick();
	searchField.value?.$el?.focus();
});

function pick(model) {
	emit('pick', model.model);
	isOpen.value = false;
}
</script>

<template>
	<Dialog v-model:open="isOpen">
		<DialogContent class="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>{{ t('chats.newTitle') }}</DialogTitle>
				<DialogDescription>{{ t('chats.newSubtitle') }}</DialogDescription>
			</DialogHeader>

			<div
				role="tablist"
				:aria-label="t('chats.pickType')"
				class="relative grid rounded-xl bg-muted p-1"
				:style="{ gridTemplateColumns: `repeat(${MODES.length}, minmax(0, 1fr))` }"
			>
				<!-- Бегунок лежит под кнопками: они прозрачные, поэтому подсветка видна сквозь них -->
				<span
					class="absolute inset-y-1 left-1 rounded-lg border border-border bg-background shadow-xs transition-transform duration-300 ease-out"
					:style="thumbStyle"
					aria-hidden="true"
				/>

				<button
					v-for="mode in MODES"
					:key="mode.type"
					type="button"
					role="tab"
					:aria-selected="mode.type === activeType"
					:class="
						cn(
							'relative z-10 flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
							'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
							mode.type === activeType
								? 'text-foreground'
								: 'text-muted-foreground hover:text-foreground',
						)
					"
					@click="activeType = mode.type"
				>
					<component :is="mode.icon" class="size-4 shrink-0" />
					<span class="truncate">{{ t(`chats.modes.${mode.type}`) }}</span>
				</button>
			</div>

			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					ref="searchField"
					v-model.trim="query"
					type="search"
					:placeholder="t('chats.searchModel')"
					class="pl-9"
				/>
			</div>

			<div class="-mx-1 max-h-72 overflow-y-auto px-1">
				<div v-if="found.length" class="grid gap-2">
					<button
						v-for="model in found"
						:key="model.model"
						type="button"
						:class="
							cn(
								'group flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
								'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
								model.model === modelValue
									? 'border-primary bg-primary/5'
									: 'border-border hover:border-primary/40 hover:bg-accent/40',
							)
						"
						@click="pick(model)"
					>
						<ModelLogo :model="model.model" :src="model.logo" class="mt-0.5 size-9" />

						<span class="grid min-w-0 flex-1 gap-0.5">
							<span class="truncate text-sm font-semibold tracking-tight">
								{{ model.name ?? model.model }}
							</span>
							<span v-if="model.description" class="line-clamp-2 text-sm text-muted-foreground">
								{{ model.description }}
							</span>
						</span>

						<ChevronRight
							class="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
						/>
					</button>
				</div>

				<p v-else-if="isFailed" class="py-8 text-center text-sm text-muted-foreground">
					{{ t('chats.searchFailed') }}
				</p>

				<p v-else class="py-8 text-center text-sm text-muted-foreground">
					{{ needle ? t('chats.searchEmpty') : t('chats.modeEmpty') }}
				</p>
				<!-- Модель нашлась, но в соседнем режиме: иначе вкладка молчит, будто поиск пуст -->
				<p v-if="elsewhere > 0" class="pt-3 text-center text-xs text-muted-foreground">
					{{ t('chats.searchElsewhere') }}
				</p>
			</div>
		</DialogContent>
	</Dialog>
</template>
