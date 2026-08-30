<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import ModelLogo from './ModelLogo.vue';
import { useModels } from '../composables/useModels';

const props = defineProps({
	modelValue: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
	// SelectRoot не рендерит собственный узел, поэтому класс переносим на триггер вручную
	class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { models, groups } = useModels();

const value = computed({
	get: () => props.modelValue,
	set: (next) => emit('update:modelValue', next),
});

const selected = computed(() => models.value.find((model) => model.model === value.value));
</script>

<template>
	<Select v-model="value" :disabled="disabled">
		<SelectTrigger :class="cn('h-11 w-full', props.class)">
			<!-- Свой слот вместо стандартного текста: иначе в закрытом селекте оказалось бы и описание -->
			<SelectValue>
				<span v-if="selected" class="flex items-center gap-2">
					<ModelLogo :model="selected.model" :src="selected.logo" class="size-6" />
					{{ selected.name ?? selected.model }}
				</span>
				<span v-else class="text-muted-foreground">{{ t('chats.pickModel') }}</span>
			</SelectValue>
		</SelectTrigger>

		<!-- popper: только в этом режиме reka-ui отдаёт ширину триггера, иначе список меряется по тексту -->
		<SelectContent
			position="popper"
			class="w-(--reka-select-trigger-width) max-w-[calc(100vw-2rem)]"
		>
			<SelectGroup v-for="group in groups" :key="group.type">
				<SelectLabel>{{ t(`chats.types.${group.type}`) }}</SelectLabel>
				<SelectItem
					v-for="model in group.models"
					:key="model.model"
					:value="model.model"
					class="items-start py-2"
				>
					<ModelLogo :model="model.model" :src="model.logo" class="mt-0.5 size-7" />
					<div class="grid min-w-0 gap-0.5">
						<span class="font-medium">{{ model.name ?? model.model }}</span>
						<span v-if="model.description" class="text-xs whitespace-normal text-muted-foreground">
							{{ model.description }}
						</span>
					</div>
				</SelectItem>
			</SelectGroup>
		</SelectContent>
	</Select>
</template>
