<script setup>
import useVuelidate from '@vuelidate/core';
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { authClient, authErrorKey } from '@/lib/auth-client';
import FormField from './FormField.vue';
import { firstError, rules } from '../validators';

/** Смена пароля может закрыть сессии на других устройствах — списку есть что перечитать */
const emit = defineEmits(['changed']);

const { t } = useI18n();

const form = reactive({ currentPassword: '', newPassword: '' });
const revokeOthers = ref(true);
const status = ref('idle');
const errorMessage = ref('');

const v$ = useVuelidate(
	{
		currentPassword: { required: rules.required },
		newPassword: { required: rules.required, minLength: rules.minLength(8) },
	},
	form,
);

async function submit() {
	if (!(await v$.value.$validate())) return;

	status.value = 'saving';
	errorMessage.value = '';

	const { error } = await authClient.changePassword({
		currentPassword: form.currentPassword,
		newPassword: form.newPassword,
		revokeOtherSessions: revokeOthers.value,
	});

	if (error) {
		status.value = 'idle';
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
		return;
	}

	form.currentPassword = '';
	form.newPassword = '';
	v$.value.$reset();
	status.value = 'saved';
	emit('changed');
}
</script>

<template>
	<Card>
		<CardHeader>
			<CardTitle class="text-base">{{ t('account.passwordSection') }}</CardTitle>
		</CardHeader>
		<CardContent>
			<!-- Пара полей в строку: карточка теперь во всю ширину страницы -->
			<form class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="submit">
				<FormField
					v-model="form.currentPassword"
					type="password"
					autocomplete="current-password"
					:label="t('account.currentPassword')"
					:error="firstError(v$.currentPassword)"
					@blur="v$.currentPassword.$touch()"
				/>

				<FormField
					v-model="form.newPassword"
					type="password"
					autocomplete="new-password"
					:label="t('account.newPassword')"
					:hint="t('auth.passwordHint')"
					:error="firstError(v$.newPassword)"
					@blur="v$.newPassword.$touch()"
				/>

				<Label class="gap-2 text-sm font-normal text-muted-foreground sm:col-span-2">
					<input v-model="revokeOthers" type="checkbox" class="size-4 accent-primary" />
					{{ t('account.revokeOthers') }}
				</Label>

				<Alert v-if="errorMessage" variant="destructive" class="sm:col-span-2">
					<AlertDescription>{{ errorMessage }}</AlertDescription>
				</Alert>
				<p v-else-if="status === 'saved'" class="text-sm text-muted-foreground sm:col-span-2">
					{{ t('account.passwordChanged') }}
				</p>

				<div class="sm:col-span-2">
					<Button type="submit" :disabled="status === 'saving'">
						{{ status === 'saving' ? t('common.saving') : t('account.changePassword') }}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</template>
