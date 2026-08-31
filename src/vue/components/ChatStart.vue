<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ModelLogo from './ModelLogo.vue';
import { useModels } from '../composables/useModels';

/**
 * Экран нового чата: посередине — модель, которая будет отвечать, под ней готовые
 * запросы. Режим и саму модель выбирают в диалоге создания, сменить её можно из шапки.
 */
const props = defineProps({
	model: { type: String, default: '' },
});

const emit = defineEmits(['pick']);

const { t, tm, rt } = useI18n();
const { models } = useModels();

const selected = computed(() => models.value.find((item) => item.model === props.model) ?? null);

/**
 * Готовые запросы лежат в локалях по типу генерации: у картинок, роликов и переписки
 * они разные. Бэкенд их не отдаёт — это подписи интерфейса, а не данные чата.
 */
const starters = computed(() => {
	if (!selected.value) return [];

	// tm отдаёт узел целиком; te для массива всегда false, поэтому проверяем сами
	const messages = tm(`chats.starters.${selected.value.type}`);

	return Array.isArray(messages) ? messages.map((item) => rt(item)) : [];
});
</script>

<template>
	<!-- flex-1: родитель растянут на свободную высоту ленты, отсюда модель и стоит по центру -->
	<section class="flex flex-1 flex-col items-center justify-center gap-6 py-6">
		<!-- Модель уже выбрана в диалоге: здесь она подпись, а не решение -->
		<div v-if="selected" class="flex flex-col items-center gap-3">
			<ModelLogo :model="selected.model" :src="selected.logo" class="size-14" />

			<div class="grid justify-items-center gap-1">
				<h2 class="text-2xl font-black tracking-tight">
					{{ selected.name ?? selected.model }}
				</h2>
			</div>
		</div>

		<!-- Модель в адресе не указана: диалог уже открыт поверх, здесь только объяснение -->
		<p v-else class="text-sm text-muted-foreground">{{ t('chats.pickModel') }}</p>

		<!--
			Затравки: щелчок кладёт текст в поле ввода, а не отправляет — запрос почти всегда
			хочется поправить под себя. Две колонки, и ширину блок держит: на широком экране
			плитка в пол-экрана — это одна строчка текста в пустой рамке.
		-->
		<div v-if="starters.length" class="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
			<button
				v-for="starter in starters"
				:key="starter"
				type="button"
				class="rounded-lg border border-border bg-card/50 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
				@click="emit('pick', starter)"
			>
				{{ starter }}
			</button>
		</div>
	</section>
</template>
