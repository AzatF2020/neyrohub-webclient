<script setup>
import {
	Brain,
	FileType,
	Globe,
	Monitor,
	Plus,
	SendHorizontal,
	Settings2,
	ShieldCheck,
	SlidersHorizontal,
	Square,
	Timer,
	X,
} from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
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
import { isTextGeneration, parseRatio } from '@/lib/neurals';
import { useLightbox } from '../composables/useLightbox';
import { useModels } from '../composables/useModels';
import AspectRatioSelect from './AspectRatioSelect.vue';
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
const { open: openImage } = useLightbox();
const { models, modelOptions, modelControls, modelType, defaultOptions } = useModels();

const prompt = ref('');
const options = ref({});
/** Ссылка, которую сейчас вводят: в options она попадёт только целой */
const url = ref('');
const isAttaching = ref(false);
const urlField = ref(null);

/** У чата с текстовой моделью и подсказка другая: тут не задание, а разговор */
const isChat = computed(() => isTextGeneration(modelType(props.model)));

const promptField = computed(() =>
	modelOptions(props.model).find((field) => field.name === 'prompt'),
);
/** Вложения поддерживает не каждая модель — поле для них есть только там, где они описаны */
const attachments = computed(() =>
	modelOptions(props.model).find((field) => field.type === 'image_list'),
);
const images = computed(() => (attachments.value && options.value[attachments.value.name]) || []);

/** Зависимый параметр показываем, только когда заполнен тот, от которого он зависит */
const fields = computed(() =>
	modelControls(props.model).filter(
		(field) => !field.requires || isFilled(options.value[field.requires]),
	),
);

/** Промпт бывает необязательным: например, когда вместо него приложены изображения */
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

const canAttachMore = computed(
	() => Boolean(attachments.value) && images.value.length < (attachments.value.max ?? Infinity),
);
const canSend = computed(
	() =>
		(Boolean(prompt.value.trim()) || !needsPrompt.value) &&
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

function isFilled(value) {
	if (Array.isArray(value)) return value.length > 0;

	return value !== '' && value !== null && value !== undefined;
}

/** Загрузки файлов на бэкенде нет: провайдер забирает картинку по ссылке, поэтому её и просим */
function isImageUrl(value) {
	try {
		return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
	} catch {
		return false;
	}
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
	if (attachments.value) options.value[attachments.value.name] = [];

	url.value = '';
	isAttaching.value = false;
}

/** Значение вне диапазона бэкенд не примет — поправляем сразу, не дожидаясь ошибки */
function clamp(field) {
	const value = Number(options.value[field.name]);

	options.value[field.name] = Number.isFinite(value)
		? Math.min(Math.max(value, field.min ?? value), field.max ?? value)
		: '';
}

async function startAttaching() {
	isAttaching.value = true;
	await nextTick();
	urlField.value?.$el?.focus();
}

function addImage() {
	if (!isImageUrl(url.value) || !canAttachMore.value) return;

	options.value[attachments.value.name] = [...images.value, url.value.trim()];
	url.value = '';
}

function removeImage(index) {
	options.value[attachments.value.name] = images.value.filter((_, item) => item !== index);
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

function payload() {
	return {
		...filledOptions(),
		// Пустой промпт не отправляем вовсе: бэкенд проверяет его, только если он пришёл
		...(prompt.value.trim() ? { prompt: prompt.value.trim() } : {}),
	};
}

function submit() {
	if (!canSend.value) return;

	emit('submit', payload());
	prompt.value = '';
	if (attachments.value) options.value[attachments.value.name] = [];
}
</script>

<template>
	<form
		class="grid gap-3 rounded-xl border border-border bg-card/70 p-3 supports-backdrop-filter:backdrop-blur-md"
		@submit.prevent="submit"
	>
		<!-- Вложения выше промпта: они могут его заменить, а не только дополнить -->
		<div v-if="images.length" class="flex flex-wrap gap-2">
			<div v-for="(image, index) in images" :key="image" class="relative">
				<button type="button" class="block cursor-zoom-in" @click="openImage(image)">
					<img
						:src="image"
						alt=""
						class="size-14 rounded-lg border border-border object-cover"
					/>
				</button>
				<Button
					variant="secondary"
					size="icon"
					class="absolute -top-1.5 -right-1.5 size-5 rounded-full"
					:aria-label="t('chats.attachRemove')"
					@click="removeImage(index)"
				>
					<X class="size-3" />
				</Button>
			</div>
		</div>

		<Textarea
			v-model="prompt"
			:placeholder="placeholder"
			:maxlength="promptField?.max"
			:disabled="disabled"
			class="max-h-32 min-h-9 resize-none border-0 px-0 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
			@keydown.enter.exact.prevent="submit"
		/>

		<div v-if="isAttaching" class="grid gap-1.5">
			<div v-if="canAttachMore" class="flex gap-2">
				<Input
					ref="urlField"
					v-model="url"
					type="url"
					inputmode="url"
					:placeholder="t('chats.attachUrl')"
					:disabled="disabled"
					class="h-8"
					@keydown.enter.prevent="addImage"
					@keydown.esc="isAttaching = false"
				/>
				<Button
					type="button"
					size="sm"
					variant="secondary"
					:disabled="!isImageUrl(url)"
					@click="addImage"
				>
					{{ t('chats.attachAdd') }}
				</Button>
			</div>

			<p v-if="!canAttachMore" class="text-xs text-muted-foreground">
				{{ t('chats.attachLimit', { count: attachments.max }) }}
			</p>
			<p v-else-if="url && !isImageUrl(url)" class="text-xs text-destructive">
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
				<Button
					v-if="attachments"
					type="button"
					:variant="isAttaching ? 'secondary' : 'outline'"
					size="icon"
					:disabled="disabled"
					:title="t('chats.attach')"
					:aria-label="t('chats.attach')"
					class="size-8 rounded-full"
					@click="isAttaching ? (isAttaching = false) : startAttaching()"
				>
					<Plus class="size-4" />
				</Button>

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
