<script setup>
import { ChevronDown, Repeat2 } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import ModelLogo from './ModelLogo.vue';
import { useChatCreate } from '../composables/useChatCreate';
import { useModels } from '../composables/useModels';

/**
 * Экран нового чата после выбора модели: режим и саму модель выбирают в диалоге
 * создания, здесь остаётся только показать, кто будет отвечать, и чем он хорош.
 */
const props = defineProps({
	model: { type: String, default: '' },
});

const { t } = useI18n();
const { models } = useModels();
const { open: openCreate } = useChatCreate();

// Описание открыто сразу: до первого запроса это единственное, что говорит о модели
const isAboutOpen = ref(true);

const selected = computed(() => models.value.find((item) => item.model === props.model) ?? null);
</script>

<template>
	<section class="grid gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">{{ t('chats.startTitle') }}</h2>

		<!-- Модель уже выбрана в диалоге: здесь она подпись, а не решение -->
		<div v-if="selected" class="grid gap-2">
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<ModelLogo :model="selected.model" :src="selected.logo" class="size-6" />
				<span class="font-medium">{{ selected.name ?? selected.model }}</span>
				<span class="text-muted-foreground">· {{ t(`chats.modes.${selected.type}`) }}</span>

				<button
					v-if="selected.description"
					type="button"
					class="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
					:aria-expanded="isAboutOpen"
					@click="isAboutOpen = !isAboutOpen"
				>
					{{ t('chats.modelAbout') }}
					<ChevronDown class="size-4 transition-transform" :class="isAboutOpen && 'rotate-180'" />
				</button>

				<Button variant="ghost" size="sm" class="ml-auto" @click="openCreate">
					<Repeat2 class="size-4" />
					{{ t('chats.changeModel') }}
				</Button>
			</div>

			<p v-if="isAboutOpen" class="max-w-prose text-sm text-muted-foreground">
				{{ selected.description }}
			</p>
		</div>

		<!-- Модель в адресе не указана: диалог уже открыт поверх, здесь только объяснение -->
		<p v-else class="text-sm text-muted-foreground">{{ t('chats.pickModel') }}</p>
	</section>
</template>
