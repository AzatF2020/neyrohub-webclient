<script setup>
import { useI18n } from 'vue-i18n';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Ожидание содержимого: спиннер с подписью. Скелет обещает форму того, что появится,
 * а у ленты чата она заранее неизвестна — сообщений может не быть вовсе. Индикатор
 * нейтральный, поэтому один и тот же и в чате, и в списках.
 *
 * flex-1 работает там, где место вызова растянуто на свободную высоту (лента чата) —
 * тогда спиннер стоит по её центру. В обычном потоке высоту держит py, его же и
 * переопределяют классом снаружи.
 */
const props = defineProps({
	class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
});

const { t } = useI18n();
</script>

<template>
	<!-- Подпись читает screen reader с обёртки, поэтому саму иконку от него скрываем -->
	<div
		:class="cn('flex flex-1 flex-col items-center justify-center gap-3 py-20', props.class)"
		role="status"
		:aria-label="t('common.loading')"
	>
		<Spinner class="size-5 text-muted-foreground" aria-hidden="true" />
		<p class="text-sm text-muted-foreground">{{ t('common.loading') }}</p>
	</div>
</template>
