<script setup>
import { XIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';

/**
 * Навигация на узком экране: sheet из набора, выезжающий от левого края.
 * Своя кнопка закрытия вместо встроенной — та подписана по-английски,
 * а ширину сужаем с трёх четвертей экрана до ширины сайдбара.
 */
const props = defineProps({
	open: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open']);

const { t } = useI18n();
</script>

<template>
	<Sheet :open="props.open" @update:open="emit('update:open', $event)">
		<SheetContent
			side="left"
			:show-close-button="false"
			class="data-[side=left]:w-72 data-[side=left]:max-w-[calc(100%-3rem)] border-border bg-sidebar p-4"
		>
			<SheetTitle class="sr-only">{{ t('common.menu') }}</SheetTitle>

			<slot />

			<SheetClose as-child>
				<Button variant="ghost" size="icon-sm" class="absolute top-3 right-3">
					<XIcon />
					<span class="sr-only">{{ t('common.close') }}</span>
				</Button>
			</SheetClose>
		</SheetContent>
	</Sheet>
</template>
