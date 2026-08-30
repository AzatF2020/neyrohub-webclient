<script setup>
import { Sparkles } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { modelLogo } from '@/lib/neurals';
import { cn } from '@/lib/utils';

const props = defineProps({
	model: { type: String, default: '' },
	/** Готовый адрес значка — если он придёт вместе с моделью, слаг не понадобится */
	src: { type: String, default: '' },
	class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
});

const source = computed(() => props.src || modelLogo(props.model));
const isBroken = ref(false);

watch(source, () => (isBroken.value = false));
</script>

<template>
	<span
		:class="
			cn(
				'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background',
				props.class,
			)
		"
	>
		<img
			v-if="source && !isBroken"
			:src="source"
			:alt="model"
			class="size-full object-contain"
			@error="isBroken = true"
		/>
		<Sparkles v-else class="size-1/2 text-muted-foreground" />
	</span>
</template>
