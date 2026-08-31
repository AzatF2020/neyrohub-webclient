<script setup>
import { Coins } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCredits, formatRubles } from '@/lib/credits';
import { isTextGeneration } from '@/lib/neurals';
import { PRICE_PROMPT } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { useModelPrice } from '../composables/useModelPrice';
import { useModels } from '../composables/useModels';

/**
 * Сколько кредитов спишется за одну генерацию этой моделью с этими параметрами.
 * Считает бэкенд: у каждой модели своя формула, и повторять её здесь значило бы
 * держать две правды о цене.
 */
const props = defineProps({
	model: { type: String, default: '' },
	/** Тип генерации: у текста цена приблизительная, списывается она по факту */
	type: { type: String, default: '' },
	/** Параметры генерации без промпта — его подставляет сам компонент */
	options: { type: Object, default: () => ({}) },
	/** Цена набора по умолчанию: в списке моделей параметров ещё никто не выбирал */
	from: { type: Boolean, default: false },
	class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
});

const { t } = useI18n();
const { modelOptions } = useModels();

/** Схема нужна не для полей, а чтобы знать, ждёт ли модель промпт: без него расчёт не примут */
const schema = computed(() => modelOptions(props.model));
const hasPrompt = computed(() => schema.value.some((field) => field.name === 'prompt'));

const { price, isFailed } = useModelPrice(() => {
	// Справочник ещё не загрузился — схемы нет, и отправлять на проверку нечего
	if (!props.model || !props.type || !schema.value.length) return null;

	return {
		type: props.type,
		model: props.model,
		options: { ...props.options, ...(hasPrompt.value ? { prompt: PRICE_PROMPT } : {}) },
	};
});

/** Текст стрима заранее не посчитать: цена справочная, за короткий ответ */
const isEstimate = computed(() => isTextGeneration(props.type));

/**
 * Точную цену не обещаем: либо это набор по умолчанию в списке моделей, либо сам
 * бэкенд пометил расчёт нижней границей — так он делает с референсными видео,
 * секунды которых до генерации неизвестны.
 */
const isFrom = computed(() => props.from || price.value?.estimate === true);

const amounts = computed(() =>
	price.value
		? { credits: formatCredits(price.value.credits), rub: formatRubles(price.value.priceRub) }
		: null,
);

const label = computed(() => {
	if (!amounts.value) return '';

	// «≈» и «от» предупреждают, что списание может отличаться: точную цену тут не обещаем
	if (isEstimate.value) return t('chats.price.about', amounts.value);

	return t(isFrom.value ? 'chats.price.from' : 'chats.price.value', amounts.value);
});

const hint = computed(() => {
	if (isFailed.value) return t('chats.price.failed');
	if (!price.value) return t('chats.price.loading');

	const credits = t(
		'chats.price.credits',
		{ count: formatCredits(price.value.credits) },
		price.value.credits,
	);
	const rub = formatRubles(price.value.priceRub);

	if (isEstimate.value) return t('chats.price.hintText', { credits, rub });

	return t(isFrom.value ? 'chats.price.hintFrom' : 'chats.price.hint', { credits, rub });
});
</script>

<template>
	<Tooltip v-if="model">
		<TooltipTrigger as-child>
			<!--
				Ширина держится минимумом, а содержимое стоит по центру: пока цена считается,
				полоска занимает место будущего числа, и соседи не разъезжаются, когда оно придёт.
			-->
			<Badge
				variant="outline"
				:class="
					cn(
						'h-7 min-w-28 gap-1.5 px-2 font-normal text-muted-foreground tabular-nums',
						props.class,
					)
				"
				role="status"
				:aria-label="hint"
			>
				<Coins class="shrink-0 opacity-60" aria-hidden="true" />

				<!-- Ожидание молчаливое: цена — подсказка, а не событие, дёргаться ей незачем -->
				<Skeleton v-if="!amounts && !isFailed" class="h-2.5 w-16 rounded-full" />
				<span v-else-if="isFailed">—</span>
				<span v-else>{{ label }}</span>
			</Badge>
		</TooltipTrigger>

		<TooltipContent>{{ hint }}</TooltipContent>
	</Tooltip>
</template>
