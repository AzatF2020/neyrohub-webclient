<script setup>
import { computed, useId } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps({
	modelValue: { type: String, default: '' },
	label: { type: String, required: true },
	type: { type: String, default: 'text' },
	autocomplete: { type: String, default: undefined },
	hint: { type: String, default: '' },
	error: { type: String, default: '' },
	autofocus: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'blur']);

const id = useId();
const value = computed({
	get: () => props.modelValue,
	set: (next) => emit('update:modelValue', next),
});
</script>

<template>
	<div class="grid gap-2">
		<Label :for="id">{{ label }}</Label>
		<Input
			:id="id"
			v-model="value"
			:type="type"
			:autocomplete="autocomplete"
			:autofocus="autofocus"
			:aria-invalid="Boolean(error)"
			@blur="emit('blur')"
		/>
		<p v-if="error" class="text-sm text-destructive">{{ error }}</p>
		<p v-else-if="hint" class="text-sm text-muted-foreground">{{ hint }}</p>
	</div>
</template>
