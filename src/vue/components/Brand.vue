<script setup>
import { Sparkles } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

defineProps({ href: { type: String, default: '/' } });

const { t } = useI18n();
</script>

<template>
	<a :href="href" class="inline-flex items-center gap-2.5">
		<span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
			<Sparkles class="size-4" />
		</span>
		<span class="text-[15px] font-semibold tracking-tight">{{ t('common.appName') }}</span>
	</a>
</template>
