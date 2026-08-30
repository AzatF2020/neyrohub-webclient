<script setup>
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Button } from '@/components/ui/button';
import { CHAT_TYPES } from '@/lib/neurals';

const { t } = useI18n();
</script>

<template>
	<section class="mx-auto grid max-w-md gap-4 py-16 text-center">
		<h1 class="text-2xl font-semibold tracking-tight">{{ t('account.notFoundTitle') }}</h1>
		<p class="text-sm text-muted-foreground">{{ t('account.notFoundText') }}</p>
		<div>
			<Button as-child variant="outline">
				<RouterLink :to="{ name: 'chats', query: { type: CHAT_TYPES[0] } }">
					{{ t('account.backToChats') }}
				</RouterLink>
			</Button>
		</div>
	</section>
</template>
