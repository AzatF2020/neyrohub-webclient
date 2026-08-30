<script setup>
import { LoaderCircle, LogOut, Monitor, Smartphone, Tablet } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { authClient, authErrorKey } from '@/lib/auth-client';
import { formatDateTime } from '@/lib/datetime';
import { parseUserAgent } from '@/lib/user-agent';
import Preloader from './Preloader.vue';
import { useSession } from '../composables/useSession';

const { t } = useI18n();
const { session } = useSession();

const sessions = ref([]);
const errorMessage = ref('');
const isLoading = ref(true);
const revokingToken = ref(null);

const DEVICE_ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

/**
 * Сырые сессии для показа: User-Agent разбирается в «браузер · система», тип устройства
 * выбирает иконку, а текущая сессия поднимается наверх — её ищут в списке первой.
 */
const devices = computed(() =>
	sessions.value
		.map((item) => {
			const { browser, os, kind } = parseUserAgent(item.userAgent);

			return {
				...item,
				icon: DEVICE_ICONS[kind],
				title: [browser, os].filter(Boolean).join(' · ') || t('account.unknownDevice'),
				isCurrent: item.token === session.value?.token,
			};
		})
		.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
);

async function load() {
	isLoading.value = true;
	errorMessage.value = '';

	const { data, error } = await authClient.listSessions();
	if (error) {
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
	} else {
		sessions.value = data ?? [];
	}
	isLoading.value = false;
}

async function revoke(token) {
	revokingToken.value = token;
	const { error } = await authClient.revokeSession({ token });
	revokingToken.value = null;

	if (error) {
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
		return;
	}

	// Отзыв текущей сессии = выход: кука станет недействительной, идём на вход через сервер
	if (token === session.value?.token) {
		window.location.href = '/login';
		return;
	}
	await load();
}

onMounted(load);

// Список перечитывает соседний блок: смена пароля могла закрыть сессии на других устройствах
defineExpose({ reload: load });
</script>

<template>
	<Card>
		<CardHeader>
			<CardTitle class="text-base">{{ t('account.sessionsSection') }}</CardTitle>
			<CardDescription>{{ t('account.sessionsHint') }}</CardDescription>
		</CardHeader>
		<CardContent>
			<Preloader v-if="isLoading" class="py-8" />

			<Alert v-else-if="errorMessage" variant="destructive">
				<AlertDescription>{{ errorMessage }}</AlertDescription>
			</Alert>

			<p v-else-if="!devices.length" class="py-4 text-sm text-muted-foreground">
				{{ t('account.sessionsEmpty') }}
			</p>

			<ul v-else class="grid gap-2">
				<li
					v-for="item in devices"
					:key="item.id"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors"
					:class="
						item.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
					"
				>
					<span
						class="grid size-9 shrink-0 place-items-center rounded-md"
						:class="
							item.isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
						"
					>
						<component :is="item.icon" class="size-4.5" />
					</span>

					<div class="min-w-0 flex-1">
						<p class="flex items-center gap-2 text-sm font-medium">
							<span class="truncate">{{ item.title }}</span>
							<Badge v-if="item.isCurrent" variant="secondary">
								{{ t('account.currentSession') }}
							</Badge>
						</p>
						<p class="truncate text-xs text-muted-foreground">
							{{ item.ipAddress || t('account.unknownIp') }} ·
							{{ t('account.expiresAt', { date: formatDateTime(item.expiresAt) }) }}
						</p>
					</div>

					<!-- Завершение чужой сессии — действие разрушительное, но редкое: держим его
						 неярким, а красным оно становится под курсором -->
					<Button
						variant="ghost"
						size="sm"
						class="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						:disabled="revokingToken === item.token"
						:aria-label="item.isCurrent ? t('account.revokeCurrent') : t('account.revoke')"
						@click="revoke(item.token)"
					>
						<LoaderCircle v-if="revokingToken === item.token" class="animate-spin" />
						<LogOut v-else />
						<span class="hidden sm:inline">
							{{ item.isCurrent ? t('account.revokeCurrent') : t('account.revoke') }}
						</span>
					</Button>
				</li>
			</ul>
		</CardContent>
	</Card>
</template>
