<script setup>
import { useI18n } from 'vue-i18n';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLightbox } from '../composables/useLightbox';

const { t } = useI18n();
const { isOpen, source, caption, isVideo } = useLightbox();
</script>

<template>
	<Dialog v-model:open="isOpen">
		<!-- Только сам файл: ни фона, ни рамки, ни отступов -->
		<DialogContent
			class="w-auto max-w-[92vw] gap-0 bg-transparent p-0 ring-0 sm:max-w-5xl"
			:show-close-button="false"
		>
			<!-- Заголовок и описание не показываем, но без них reka-ui ругается на доступность -->
			<DialogTitle class="sr-only">{{ caption || t('chats.openOriginal') }}</DialogTitle>
			<DialogDescription class="sr-only">{{ caption }}</DialogDescription>

			<video
				v-if="source && isVideo"
				:src="source"
				controls
				autoplay
				playsinline
				class="max-h-[92svh] w-auto rounded-lg"
			/>
			<img
				v-else-if="source"
				:src="source"
				:alt="caption"
				class="max-h-[92svh] w-auto rounded-lg object-contain"
			/>
		</DialogContent>
	</Dialog>
</template>
