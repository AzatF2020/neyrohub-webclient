<script setup>
import { ChevronDown } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parseRatio } from '@/lib/neurals';

const props = defineProps({
	modelValue: { type: String, default: '' },
	values: { type: Array, default: () => [] },
	label: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

/** Сторона поля, в которое вписывается рамка: в попапе и в самой кнопке */
const PREVIEW = 88;
const BADGE = 14;

const isOpen = ref(false);
const hovered = ref('');

/** Рамка показывает то, на что человек навёл, а без наведения — выбранное */
const preview = computed(() => hovered.value || props.modelValue);

// Закрыли попап — забываем наведение, иначе рамка останется в чужой форме
watch(isOpen, (open) => {
	if (!open) hovered.value = '';
});

/** Форма рамки: вписываем пропорции в квадрат со стороной box */
function frame(value, box) {
	const ratio = parseRatio(value) ?? { width: 1, height: 1 };
	const scale = box / Math.max(ratio.width, ratio.height);

	return { width: `${ratio.width * scale}px`, height: `${ratio.height * scale}px` };
}

function select(value) {
	emit('update:modelValue', value);
	isOpen.value = false;
}
</script>

<template>
	<!--
		Попап лежит внутри тултипа, а не наоборот. TooltipRoot рендерит свой PopperRoot,
		а PopperAnchor внутри PopoverTrigger инжектит ближайший — значит при обратной
		вложенности якорь уходил тултипу, попап оставался без него и reka прятала его
		через translate(0, -200%). Здесь ближайший PopperRoot для триггера — попаповский.
	-->
	<Tooltip>
		<TooltipTrigger as-child>
			<span class="inline-flex">
				<Popover v-model:open="isOpen">
					<PopoverTrigger as-child>
						<button
							type="button"
							:disabled="disabled"
							:aria-label="label"
							class="flex h-8 items-center gap-2 rounded-md border border-input px-2.5 text-sm shadow-xs transition-colors outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
						>
							<!-- Отдельный значок не нужен: рамка сама показывает, о чём параметр -->
							<span class="flex size-4 items-center justify-center text-muted-foreground">
								<span
									class="rounded-[1.5px] border border-current transition-[width,height] duration-300 ease-out motion-reduce:transition-none"
									:class="parseRatio(modelValue) ? '' : 'border-dashed'"
									:style="frame(modelValue, BADGE)"
								/>
							</span>

							{{ modelValue }}
							<ChevronDown class="size-3.5 opacity-50" />
						</button>
					</PopoverTrigger>

					<!--
						Без preventDefault reka-ui уводит фокус на первый вариант, а он через @focus
						становится наведённым — попап открывался бы с чужой формой вместо выбранной
					-->
					<PopoverContent
						side="top"
						align="start"
						:side-offset="8"
						class="w-auto gap-3 p-3"
						@open-auto-focus="(event) => event.preventDefault()"
					>
						<div class="flex items-start gap-4">
							<!-- Рамка одна на весь список: она перетекает из формы в форму, а не подменяется -->
							<div class="grid justify-items-center gap-1.5">
								<div class="flex size-22 items-center justify-center">
									<div
										class="rounded-sm border-2 border-primary transition-[width,height] duration-300 ease-out motion-reduce:transition-none"
										:class="parseRatio(preview) ? '' : 'border-dashed'"
										:style="frame(preview, PREVIEW)"
									/>
								</div>
								<span class="text-xs text-muted-foreground tabular-nums">{{ preview }}</span>
							</div>

							<!-- Ушли с вариантов — рамка возвращается к выбранному -->
							<div class="grid grid-cols-3 gap-1" @mouseleave="hovered = ''">
								<button
									v-for="value in values"
									:key="value"
									type="button"
									class="rounded-md px-2 py-1 text-xs tabular-nums transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
									:class="value === modelValue ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
									@mouseenter="hovered = value"
									@focus="hovered = value"
									@click="select(value)"
								>
									{{ value }}
								</button>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</span>
		</TooltipTrigger>

		<TooltipContent>{{ label }}</TooltipContent>
	</Tooltip>
</template>
