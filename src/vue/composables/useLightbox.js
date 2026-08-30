import { ref } from 'vue';

// Просмотрщик один на страницу: держать по диалогу в каждом сообщении незачем
const isOpen = ref(false);
const source = ref('');
const caption = ref('');

export function useLightbox() {
	function open(url, text = '') {
		source.value = url;
		caption.value = text;
		isOpen.value = true;
	}

	return { isOpen, source, caption, open };
}
