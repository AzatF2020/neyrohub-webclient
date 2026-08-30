<script setup>
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';

/**
 * Аккордеон вопросов на публичной странице. Единственный островок Vue на ней,
 * поэтому вопросы приезжают пропом из Astro, а не через i18n кабинета.
 */
const props = defineProps({
	items: { type: Array, required: true },
});
</script>

<template>
	<!--
		type="single" — открытый вопрос закрывает предыдущий; collapsible разрешает
		закрыть и последний. unmount-on-hide="false" оставляет ответы в разметке:
		страница отдаётся с сервера, и текст должен быть виден поисковикам до гидратации.
	-->
	<Accordion
		type="single"
		collapsible
		:unmount-on-hide="false"
		:default-value="props.items[0]?.question"
		class="rounded-xl border border-border bg-card px-5"
	>
		<AccordionItem v-for="item in props.items" :key="item.question" :value="item.question">
			<!-- Подчёркивание при наведении лишнее: строка и так подсвечена шевроном -->
			<AccordionTrigger class="hover:no-underline">{{ item.question }}</AccordionTrigger>
			<AccordionContent class="text-muted-foreground">{{ item.answer }}</AccordionContent>
		</AccordionItem>
	</Accordion>
</template>
