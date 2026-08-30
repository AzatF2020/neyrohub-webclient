<script setup>
import { Sparkles } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '@/lib/utils';

/**
 * Ожидание страницы: знак приложения вместо заглушек-прямоугольников. Скелет обещает
 * форму содержимого, а у ленты чата она заранее неизвестна — сообщений может не быть
 * вовсе. Дышит, а не мигает: та же анимация, что у остальных ожиданий в интерфейсе.
 */
const props = defineProps({
	class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
});

const { t } = useI18n();
</script>

<template>
	<div
		:class="cn('grid justify-items-center gap-4 py-20', props.class)"
		role="status"
		:aria-label="t('common.loading')"
	>
		<span class="relative flex size-16 items-center justify-center">
			<span
				class="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary"
				aria-hidden="true"
			/>
			<span
				class="flex size-10 animate-breathe items-center justify-center rounded-xl bg-primary text-primary-foreground"
			>
				<Sparkles class="size-5" />
			</span>
		</span>

		<p class="text-sm text-muted-foreground">{{ t('common.loading') }}</p>
	</div>
</template>
