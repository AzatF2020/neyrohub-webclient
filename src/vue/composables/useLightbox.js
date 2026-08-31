import { ref } from 'vue';

// Просмотрщик один на страницу: держать по диалогу в каждом сообщении незачем
const isOpen = ref(false);
const source = ref('');
const caption = ref('');
const isVideo = ref(false);

export function useLightbox() {
	/** Ролик открывается тем же просмотрщиком: показывать его негде, а посмотреть надо */
	function open(url, text = '', { video = false } = {}) {
		source.value = url;
		caption.value = text;
		isVideo.value = video;
		isOpen.value = true;
	}

	return { isOpen, source, caption, isVideo, open };
}
