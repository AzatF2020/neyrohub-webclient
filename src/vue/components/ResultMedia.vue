<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';

const props = defineProps({
	src: { type: String, required: true },
	video: { type: Boolean, default: false },
	alt: { type: String, default: '' },
});

const emit = defineEmits(['open']);

const { t } = useI18n();

/** Сколько раз пробуем сами, прежде чем сказать человеку, что не вышло */
const RETRIES = 4;
const RETRY_DELAY = 1500;

/**
 * Провайдер отдаёт ссылку раньше, чем по ней начинает отдаваться файл: первые запросы
 * сразу после сокет-события падают. Сам по себе <img> запрос не повторит, поэтому
 * пересоздаём элемент — счётчик попыток служит ему ключом.
 */
const attempt = ref(0);
const failures = ref(0);
const isLoaded = ref(false);
const isBroken = ref(false);
let timer = null;

watch(() => props.src, restart, { immediate: true });
onUnmounted(() => clearTimeout(timer));

function restart() {
	clearTimeout(timer);
	attempt.value = 0;
	failures.value = 0;
	isLoaded.value = false;
	isBroken.value = false;
}

function onError() {
	failures.value += 1;

	if (failures.value > RETRIES) {
		isBroken.value = true;
		return;
	}
	// Пауза растёт: файл может доехать не с первой секунды
	timer = setTimeout(() => (attempt.value += 1), RETRY_DELAY * failures.value);
}

function retry() {
	failures.value = 0;
	isBroken.value = false;
	attempt.value += 1;
}
</script>

<template>
	<!-- Сообщение об ошибке лежит поверх файла в той же ячейке: сам файл остаётся в потоке -->
	<div class="grid">
		<video
			v-if="video"
			:key="attempt"
			:src="src"
			controls
			playsinline
			preload="metadata"
			class="col-start-1 row-start-1 max-h-80 rounded-xl border border-border"
			@loadedmetadata="isLoaded = true"
			@error="onError"
		/>
		<button
			v-else
			type="button"
			class="col-start-1 row-start-1 cursor-zoom-in"
			@click="emit('open')"
		>
			<!-- Пока файла нет, alt пустой: иначе битая картинка растянет ячейку текстом -->
			<img
				:key="attempt"
				:src="src"
				:alt="isLoaded ? alt : ''"
				loading="lazy"
				class="max-h-80 rounded-xl border border-border transition-opacity hover:opacity-90"
				@load="isLoaded = true"
				@error="onError"
			/>
		</button>

		<div
			v-if="isBroken"
			class="col-start-1 row-start-1 grid justify-items-start gap-2 self-start rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
		>
			<p>{{ t('chats.mediaBroken') }}</p>
			<Button variant="secondary" size="sm" @click="retry">{{ t('chats.mediaRetry') }}</Button>
		</div>
	</div>
</template>
