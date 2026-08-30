<script setup>
import useVuelidate from '@vuelidate/core';
import { Heart, Mail } from '@lucide/vue';
import { computed, reactive, ref, useTemplateRef, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient, authErrorKey } from '@/lib/auth-client';
import { formatDate } from '@/lib/datetime';
import FormField from '../components/FormField.vue';
import PasswordForm from '../components/PasswordForm.vue';
import SessionList from '../components/SessionList.vue';
import { useSession } from '../composables/useSession';
import { firstError, rules } from '../validators';

const { t } = useI18n();
const { user, refresh } = useSession();

const form = reactive({ name: '', image: '' });
const status = ref('idle');
const errorMessage = ref('');

const sessionList = useTemplateRef('sessionList');

const v$ = useVuelidate(
	{
		name: { required: rules.required },
		image: { url: rules.url },
	},
	form,
);

watchEffect(() => {
	form.name = user.value?.name ?? '';
	form.image = user.value?.image ?? '';
});

const initials = computed(() => (user.value?.name ?? '?').trim().charAt(0).toUpperCase());

async function submit() {
	if (!(await v$.value.$validate())) return;

	status.value = 'saving';
	errorMessage.value = '';

	const { error } = await authClient.updateUser({
		name: form.name.trim(),
		image: form.image.trim() || null,
	});

	if (error) {
		status.value = 'idle';
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
		return;
	}

	await refresh();
	status.value = 'saved';
}
</script>

<template>
	<!-- Профиль и безопасность живут на одной странице: разделов у кабинета немного,
		 и ходить за паролем в соседний пункт меню было незачем -->
	<section class="grid gap-6">
		<header class="flex flex-wrap items-center gap-4">
			<Avatar class="size-14 shrink-0">
				<AvatarImage v-if="user?.image" :src="user.image" :alt="user?.name" />
				<AvatarFallback class="text-lg">{{ initials }}</AvatarFallback>
			</Avatar>

			<div class="grid min-w-0 flex-1 gap-1.5">
				<h1 class="truncate text-2xl font-semibold tracking-tight">
					{{ t('account.profileTitle') }}
				</h1>

				<div
					class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground"
				>
					<span class="flex min-w-0 items-center gap-1.5">
						<Mail class="size-3.5 shrink-0" />
						<span class="truncate">{{ user?.email }}</span>
						<Badge v-if="user && !user.emailVerified" variant="secondary">
							{{ t('account.emailUnverified') }}
						</Badge>
					</span>
					<span class="flex items-center gap-1.5">
						<Heart class="size-3.5 shrink-0 fill-current text-primary" />
						{{ t('account.memberSince', { date: formatDate(user?.createdAt) }) }}
					</span>
				</div>
			</div>
		</header>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">{{ t('account.profileSection') }}</CardTitle>
			</CardHeader>
			<CardContent>
				<!-- Поля в две колонки: во всю ширину карточки одиночное поле выглядело бы растянутым -->
				<form class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="submit">
					<FormField
						v-model="form.name"
						:label="t('account.fields.name')"
						:error="firstError(v$.name)"
						@blur="v$.name.$touch()"
					/>

					<FormField
						v-model="form.image"
						type="url"
						:label="t('account.avatarUrl')"
						:error="firstError(v$.image)"
						@blur="v$.image.$touch()"
					/>

					<Alert v-if="errorMessage" variant="destructive" class="sm:col-span-2">
						<AlertDescription>{{ errorMessage }}</AlertDescription>
					</Alert>
					<p
						v-else-if="status === 'saved'"
						class="text-sm text-muted-foreground sm:col-span-2"
					>
						{{ t('common.saved') }}
					</p>

					<div class="sm:col-span-2">
						<Button type="submit" :disabled="status === 'saving'">
							{{ status === 'saving' ? t('common.saving') : t('common.save') }}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<PasswordForm @changed="sessionList?.reload()" />

		<SessionList ref="sessionList" />
	</section>
</template>
