import { ref } from 'vue';

/**
 * Диалог создания чата живёт один на всё приложение — в AccountLayout, рядом с меню.
 * Открыть его нужно и со списка чатов, и с обзора, и с самого экрана нового чата,
 * поэтому наружу вынесен только флаг: переход после выбора делает владелец диалога.
 */
const isOpen = ref(false);
/** Режим, на котором открыть диалог: из раздела, откуда нажали «Новый чат» */
const preferredType = ref('');

export function useChatCreate() {
	function open(type = '') {
		preferredType.value = type;
		isOpen.value = true;
	}

	function close() {
		isOpen.value = false;
	}

	return { isOpen, preferredType, open, close };
}
