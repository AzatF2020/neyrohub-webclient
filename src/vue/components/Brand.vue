<script setup>
import { useI18n } from 'vue-i18n';

defineProps({ href: { type: String, default: '/' } });

const { t } = useI18n();
</script>

<template>
	<a :href="href" class="inline-flex items-center gap-2.5">
		<!-- Знак на плашке, тот же файл, что у иконки вкладки: светлый градиент читается только на тёмном фоне -->
		<img src="/icon.svg" alt="" width="32" height="32" class="size-8 rounded-lg" />
		<span class="font-heading text-[15px] font-semibold tracking-tight">{{ t('common.appName') }}</span>
	</a>
</template>
