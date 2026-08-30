<script setup>
import { Moon, Sun } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { currentTheme, setTheme } from '@/lib/theme';

const { t } = useI18n();
const theme = ref('light');

onMounted(() => {
	theme.value = currentTheme();
});

function toggle() {
	theme.value = setTheme(theme.value === 'dark' ? 'light' : 'dark');
}
</script>

<template>
	<Button
		variant="ghost"
		size="icon"
		:aria-label="theme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')"
		@click="toggle"
	>
		<Sun v-if="theme === 'dark'" class="size-4" />
		<Moon v-else class="size-4" />
	</Button>
</template>
