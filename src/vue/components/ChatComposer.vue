<script setup>
import {
	Brain,
	FileType,
	Globe,
	ImagePlus,
	Link2,
	Monitor,
	SendHorizontal,
	Settings2,
	ShieldCheck,
	SlidersHorizontal,
	Square,
	Timer,
	Upload,
	Video,
} from '@lucide/vue';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { fileMime, isFileLink, isVideoMime } from '@/lib/files';
import { attachmentFields, isTextGeneration, isVideoField, parseRatio } from '@/lib/neurals';
import { useLightbox } from '../composables/useLightbox';
import { useModels } from '../composables/useModels';
import { useUploads } from '../composables/useUploads';
import AspectRatioSelect from './AspectRatioSelect.vue';
import AttachmentTile from './AttachmentTile.vue';
import ModelPrice from './ModelPrice.vue';

const props = defineProps({
	model: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
	sending: { type: Boolean, default: false },
	/** Идёт стрим ответа: вместо отправки предлагаем его прервать */
	streaming: { type: Boolean, default: false },
});

const emit = defineEmits(['submit', 'stop']);

const { t, te } = useI18n();
const { open: openMedia } = useLightbox();
const { models, modelOptions, modelControls, modelType, defaultOptions } = useModels();
const {
	items: attached,
	isUploading,
	hasFailed,
	itemsOf,
	add,
	addLink,
	remove,
	retry,
	clear,
	resolve,
} = useUploads();

const prompt = ref('');
const options = ref({});
const promptArea = ref(null);
/** Ссылка, которую сейчас вводят: во вложения она попадёт только целой */
const url = ref('');
/** Поле, ссылку для которого сейчас вводят; null — строки ввода нет */
const attaching = ref(null);
const urlField = ref(null);
/** Один диалог выбора файла на все поля: перед открытием ему проставляют accept */
const picker = ref(null);
let picking = null;
/** Модель, которой принадлежат приложенные файлы: со сменой модели они теряют смысл */
let attachedFor = '';
const isDragging = ref(false);
/** Ссылки на вложения берутся перед самой отправкой — это её незаметная часть */
const isResolving = ref(false);

/** Подписи у картинок и роликов свои: «ссылка на изображение» и «ссылка на видео» */
const ATTACH_TEXTS = {
	image_list: { button: 'chats.attach', url: 'chats.attachUrl', limit: 'chats.attachLimit' },
	video_list: {
		button: 'chats.attachVideo',
		url: 'chats.attachVideoUrl',
		limit: 'chats.attachVideoLimit',
	},
};

/** У чата с текстовой моделью и подсказка другая: тут не задание, а разговор */
const isChat = computed(() => isTextGeneration(modelType(props.model)));

const promptField = computed(() =>
	modelOptions(props.model).find((field) => field.name === 'prompt'),
);
/**
 * Вложения поддерживает не каждая модель, а иные — сразу двумя списками: у minimax-h3
 * референсные картинки и ролики лежат в разных полях и едут в одном запросе.
 */
const attachments = computed(() => attachmentFields(modelOptions(props.model)));

/** Поле, до предела которого уже добрали: строка под вложениями объяснит неактивную кнопку */
const limited = computed(() => attachments.value.find((field) => !canAttachMore(field)) ?? null);

/** Зависимый параметр показываем, только когда заполнен тот, от которого он зависит */
const fields = computed(() =>
	modelControls(props.model).filter(
		(field) => !field.requires || isFilled(options.value[field.requires]),
	),
);

/** Промпт бывает необязательным: например, когда вместо него приложены картинки или ролики */
const needsPrompt = computed(() => {
	const field = promptField.value;
	if (!field?.required) return false;

	return !(field.requiredUnless ?? []).some((name) => isFilled(options.value[name]));
});

/**
 * Что уходит в расчёт цены: те же параметры, что и в генерацию, но без промпта —
 * на цену он не влияет, а с ним запрос улетал бы на каждую паузу в наборе текста.
 */
const priceOptions = computed(() => filledOptions());

const canSend = computed(
	() =>
		(Boolean(prompt.value.trim()) || !needsPrompt.value) &&
		// Ссылки на файл ещё нет, а сломанное вложение молча выкидывать нельзя
		!isUploading.value &&
		!hasFailed.value &&
		!isResolving.value &&
		!props.disabled &&
		!props.sending &&
		!props.streaming,
);

/** Пустой промпт у текстовой модели отправлять некуда: вложения его не заменят */
const placeholder = computed(() => {
	if (isChat.value) return t('chats.askPlaceholder');

	return needsPrompt.value ? t('chats.promptPlaceholder') : t('chats.promptOptional');
});

// Схема приходит вместе со справочником, поэтому форма пересобирается и при смене модели, и когда он загрузился
watch([() => props.model, models], () => reset(), { immediate: true });

/**
 * Ссылки готовых вложений держим и в options: по ним считается цена, и по ним же схема
 * решает, обязателен ли промпт. К отправке они обновятся — час у ссылки может и выйти.
 */
watch(
	() => attached.value.map((item) => `${item.field}:${item.status}:${item.url}`).join('\n'),
	syncAttachments,
);

onUnmounted(() => clear({ discard: true }));

function isFilled(value) {
	if (Array.isArray(value)) return value.length > 0;

	return value !== '' && value !== null && value !== undefined;
}

function syncAttachments() {
	for (const field of attachments.value) {
		options.value[field.name] = itemsOf(field.name)
			.filter((item) => item.status === 'ready')
			.map((item) => item.url);
	}
}

function countOf(field) {
	return itemsOf(field.name).length;
}

function canAttachMore(field) {
	return countOf(field) < (field.max ?? Infinity);
}

function attachText(field, kind) {
	return t(ATTACH_TEXTS[field.type][kind], { count: field.max });
}

function attachIcon(field) {
	return isVideoField(field) ? Video : ImagePlus;
}

/** Пропорции показываем рамкой, а не строчками «16:9»: форму видно сразу */
function isRatioField(field) {
	return field.type === 'enum' && field.values.some((value) => parseRatio(value));
}

/** Для незнакомого параметра подписи нет — показываем его имя как есть */
function label(name) {
	const key = `chats.options.${name}`;
	return te(key) ? t(key) : name;
}

/**
 * Значок параметра. Подписи словами занимали всю строку под промптом и повторялись
 * рядом со своим же значением («Разрешение 480p»), поэтому название переехало в
 * тултип, а в строке остался значок. Незнакомому параметру достаётся общий.
 */
const OPTION_ICONS = {
	mode: SlidersHorizontal,
	duration: Timer,
	resolution: Monitor,
	output_format: FileType,
	nsfw_checker: ShieldCheck,
	reasoning: Brain,
	web_search: Globe,
};

function icon(name) {
	return OPTION_ICONS[name] ?? Settings2;
}

function reset() {
	options.value = defaultOptions(props.model);
	for (const field of attachments.value) options.value[field.name] = [];

	// Сменилась модель — её вложения новой не подойдут, и в хранилище им делать нечего.
	// Форма пересобирается и от загрузки справочника: тогда вложения остаются на месте
	if (attachedFor !== props.model) {
		clear({ discard: true });
		attachedFor = props.model;
	}
	syncAttachments();

	url.value = '';
	attaching.value = null;
}

/** Значение вне диапазона бэкенд не примет — поправляем сразу, не дожидаясь ошибки */
function clamp(field) {
	const value = Number(options.value[field.name]);

	options.value[field.name] = Number.isFinite(value)
		? Math.min(Math.max(value, field.min ?? value), field.max ?? value)
		: '';
}

/** Диалог выбора один: тип файлов и число зависят от поля, для которого его открыли */
function pickFiles(field) {
	const input = picker.value;
	if (!input) return;

	picking = field;
	input.accept = isVideoField(field) ? 'video/*' : 'image/*';
	input.multiple = (field.max ?? Infinity) > 1;
	// Тот же файл, выбранный второй раз подряд, иначе не вызовет change
	input.value = '';
	input.click();
}

function onPicked(event) {
	if (picking) add(picking, event.target.files);
	event.target.value = '';
}

/** Файл кладём в то поле, которое его примет: ролик — к роликам, картинку — к картинкам */
function fieldFor(file) {
	const video = isVideoMime(fileMime(file));

	return attachments.value.find((field) => isVideoField(field) === video) ?? null;
}

function addDropped(files) {
	const groups = new Map();

	for (const file of files) {
		const field = fieldFor(file);
		if (field) groups.set(field, [...(groups.get(field) ?? []), file]);
	}
	for (const [field, group] of groups) add(field, group);
}

function onDragOver(event) {
	if (props.disabled || !attachments.value.length) return;

	isDragging.value = event.dataTransfer?.types?.includes('Files') ?? false;
}

// Перетаскивание над содержимым формы — это всё ещё перетаскивание над ней самой
function onDragLeave(event) {
	if (!event.currentTarget.contains(event.relatedTarget)) isDragging.value = false;
}

function onDrop(event) {
	isDragging.value = false;
	if (props.disabled || !attachments.value.length) return;

	addDropped(event.dataTransfer?.files ?? []);
}

/** Скриншот из буфера — тоже вложение: иначе он доедет до модели только через «сохранить как» */
function onPaste(event) {
	const files = [...(event.clipboardData?.files ?? [])];
	if (props.disabled || !files.length || !attachments.value.length) return;

	event.preventDefault();
	addDropped(files);
}

async function startAttaching(field) {
	attaching.value = field;
	url.value = '';

	await nextTick();
	urlField.value?.$el?.focus();
}

/** Модель заберёт файл по ссылке сама — грузить его к себе незачем */
function addAttachment() {
	const field = attaching.value;
	if (!field || !isFileLink(url.value.trim()) || !canAttachMore(field)) return;

	addLink(field, url.value.trim());
	url.value = '';
}

/** Уходит только заполненное: пустое поле означает «параметр не задан» */
function filledOptions() {
	const numbers = fields.value
		.filter((field) => field.type === 'number')
		.map((field) => field.name);

	return Object.fromEntries(
		Object.entries(options.value)
			.filter(([, value]) => isFilled(value))
			.map(([name, value]) => [name, numbers.includes(name) ? Number(value) : value]),
	);
}

function payload(files) {
	return {
		...filledOptions(),
		...files,
		// Пустой промпт не отправляем вовсе: бэкенд проверяет его, только если он пришёл
		...(prompt.value.trim() ? { prompt: prompt.value.trim() } : {}),
	};
}

/** Затравка с экрана нового чата: кладём её в поле, а не отправляем — её ещё поправят */
function fill(text) {
	prompt.value = text;
	promptArea.value?.$el?.focus();
}

defineExpose({ fill });

async function submit() {
	if (!canSend.value) return;

	isResolving.value = true;
	let files = null;
	try {
		// Модели принимают ссылки, а живут они час: берём их прямо перед отправкой
		files = await resolve();
	} finally {
		isResolving.value = false;
	}
	// Какого-то файла уже нет — вложение помечено ошибкой, и запрос без него отправлять нельзя
	if (!files) return;

	emit('submit', payload(files));
	prompt.value = '';
	clear();
	for (const field of attachments.value) options.value[field.name] = [];
}
</script>

<template>
	<form
		class="relative grid gap-3 rounded-xl border border-border bg-card/70 p-3 supports-backdrop-filter:backdrop-blur-md"
		@submit.prevent="submit"
		@dragover.prevent="onDragOver"
		@dragleave="onDragLeave"
		@drop.prevent="onDrop"
	>
		<!-- Диалог выбора файла: свой вид у него не показывается, кнопки открывают этот -->
		<input ref="picker" type="file" class="hidden" @change="onPicked" />

		<div
			v-if="isDragging"
			class="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/85 text-sm font-medium"
		>
			{{ t('files.dropHere') }}
		</div>

		<!-- Вложения выше промпта: они могут его заменить, а не только дополнить -->
		<div v-if="attached.length" class="flex flex-wrap gap-2">
			<AttachmentTile
				v-for="item in attached"
				:key="item.key"
				:item="item"
				@open="openMedia(item.preview, '', { video: item.isVideo })"
				@retry="retry(item)"
				@remove="remove(item)"
			/>
		</div>

		<p v-if="limited" class="text-xs text-muted-foreground">
			{{ attachText(limited, 'limit') }}
		</p>

		<Textarea
			ref="promptArea"
			v-model="prompt"
			:placeholder="placeholder"
			:maxlength="promptField?.max"
			:disabled="disabled"
			class="max-h-32 min-h-9 resize-none border-0 px-0 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
			@keydown.enter.exact.prevent="submit"
			@paste="onPaste"
		/>

		<div v-if="attaching" class="grid gap-1.5">
			<div v-if="canAttachMore(attaching)" class="flex gap-2">
				<Input
					ref="urlField"
					v-model="url"
					type="url"
					inputmode="url"
					:placeholder="attachText(attaching, 'url')"
					:disabled="disabled"
					class="h-8"
					@keydown.enter.prevent="addAttachment"
					@keydown.esc="attaching = null"
				/>
				<Button
					type="button"
					size="sm"
					variant="secondary"
					:disabled="!isFileLink(url.trim())"
					@click="addAttachment"
				>
					{{ t('chats.attachAdd') }}
				</Button>
			</div>

			<p v-if="url && !isFileLink(url.trim())" class="text-xs text-destructive">
				{{ t('validation.url') }}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<template v-for="field in fields" :key="field.name">
				<AspectRatioSelect
					v-if="isRatioField(field)"
					v-model="options[field.name]"
					:values="field.values"
					:label="label(field.name)"
					:disabled="disabled"
				/>

				<!--
					Селект целиком внутри тултипа: TooltipRoot рендерит свой PopperRoot, и при
					обратной вложенности якорь уходил бы ему, а не выпадающему списку
				-->
				<Tooltip v-else-if="field.type === 'enum'">
					<TooltipTrigger as-child>
						<span class="inline-flex">
							<Select v-model="options[field.name]" :disabled="disabled">
								<SelectTrigger size="sm" class="w-auto" :aria-label="label(field.name)">
									<component :is="icon(field.name)" class="size-4 text-muted-foreground" />
									<SelectValue />
								</SelectTrigger>

								<SelectContent>
									<SelectItem v-for="option in field.values" :key="option" :value="option">
										{{ option }}
									</SelectItem>
								</SelectContent>
							</Select>
						</span>
					</TooltipTrigger>
					<TooltipContent>{{ label(field.name) }}</TooltipContent>
				</Tooltip>

				<Tooltip v-else>
					<TooltipTrigger as-child>
						<label
							class="flex h-8 items-center gap-2 rounded-md border border-input px-2.5 text-sm shadow-xs"
						>
							<component :is="icon(field.name)" class="size-4 text-muted-foreground" />

							<Input
								v-if="field.type === 'number'"
								v-model="options[field.name]"
								type="number"
								:min="field.min"
								:max="field.max"
								:step="field.step"
								:placeholder="`${field.min}–${field.max}`"
								:disabled="disabled"
								:aria-label="label(field.name)"
								class="h-auto w-14 border-0 p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
								@change="clamp(field)"
							/>
							<Switch
								v-else
								v-model="options[field.name]"
								size="sm"
								:disabled="disabled"
								:aria-label="label(field.name)"
							/>
						</label>
					</TooltipTrigger>
					<TooltipContent>{{ label(field.name) }}</TooltipContent>
				</Tooltip>
			</template>

			<!--
				Ценник стоит после параметров, а не рядом с кнопкой: он меняется вместе с ними,
				и кнопки от его ширины не разъезжаются — их держит у края ml-auto.
			-->
			<ModelPrice :model="model" :type="modelType(model)" :options="priceOptions" />

			<!-- Действия держатся вместе у правого края и переносятся тоже вместе -->
			<div class="ml-auto flex items-center gap-2">
				<!-- Кнопка на каждый список: картинки и ролики модель принимает разными полями -->
				<Tooltip v-for="field in attachments" :key="field.name">
					<TooltipTrigger as-child>
						<span class="inline-flex">
							<DropdownMenu>
								<DropdownMenuTrigger as-child>
									<Button
										type="button"
										variant="outline"
										size="icon"
										:disabled="disabled || !canAttachMore(field)"
										:aria-label="attachText(field, 'button')"
										class="size-8 rounded-full"
									>
										<component :is="attachIcon(field)" class="size-4" />
									</Button>
								</DropdownMenuTrigger>

								<DropdownMenuContent align="end">
									<DropdownMenuItem @select="pickFiles(field)">
										<Upload class="size-4" />
										{{ t('files.pick') }}
									</DropdownMenuItem>
									<DropdownMenuItem @select="startAttaching(field)">
										<Link2 class="size-4" />
										{{ t('files.paste') }}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</span>
					</TooltipTrigger>
					<TooltipContent>{{ attachText(field, 'button') }}</TooltipContent>
				</Tooltip>

				<Button
					v-if="streaming"
					type="button"
					variant="secondary"
					size="sm"
					@click="emit('stop')"
				>
					<Square class="size-4" />
					{{ t('chats.stop') }}
				</Button>

				<Button v-else type="submit" size="sm" :disabled="!canSend">
					<SendHorizontal class="size-4" />
					{{ sending ? t('chats.sending') : t('chats.send') }}
				</Button>
			</div>
		</div>
	</form>
</template>
