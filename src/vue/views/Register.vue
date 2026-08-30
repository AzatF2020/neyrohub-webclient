<script setup>
import useVuelidate from '@vuelidate/core';
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient, authErrorKey } from '@/lib/auth-client';
import FormField from '../components/FormField.vue';
import { useSession } from '../composables/useSession';
import { firstError, rules } from '../validators';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { refresh } = useSession();

const form = reactive({ name: '', email: '', password: '' });
const isSubmitting = ref(false);
const errorMessage = ref('');

const v$ = useVuelidate(
	{
		name: {},
		email: { required: rules.required, email: rules.email },
		password: { required: rules.required, minLength: rules.minLength(8) },
	},
	form,
);

function safeRedirect() {
	const target = route.query.redirect;
	return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
		? target
		: '/app';
}

async function submit() {
	if (!(await v$.value.$validate())) return;

	isSubmitting.value = true;
	errorMessage.value = '';

	const email = form.email.trim();
	const { error } = await authClient.signUp.email({
		email,
		password: form.password,
		// Если имя не заполнено, хук before на бэкенде подставит часть email до @
		name: form.name.trim() || email.split('@')[0],
	});

	if (error) {
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
		isSubmitting.value = false;
		return;
	}

	// autoSignIn: true — сессия уже выдана, идём сразу в кабинет
	await refresh();
	router.push(safeRedirect());
}
</script>

<template>
	<Card class="bg-card/70 supports-backdrop-filter:backdrop-blur-md">
		<CardHeader>
			<CardTitle class="text-xl">{{ t('auth.registerTitle') }}</CardTitle>
			<CardDescription>{{ t('auth.registerSubtitle') }}</CardDescription>
		</CardHeader>

		<CardContent>
			<form class="grid gap-4" novalidate @submit.prevent="submit">
				<FormField
					v-model="form.name"
					autocomplete="name"
					:label="`${t('auth.name')} · ${t('common.optional')}`"
				/>

				<FormField
					v-model="form.email"
					type="email"
					autocomplete="email"
					:label="t('auth.email')"
					:error="firstError(v$.email)"
					@blur="v$.email.$touch()"
				/>

				<FormField
					v-model="form.password"
					type="password"
					autocomplete="new-password"
					:label="t('auth.password')"
					:hint="t('auth.passwordHint')"
					:error="firstError(v$.password)"
					@blur="v$.password.$touch()"
				/>

				<Alert v-if="errorMessage" variant="destructive">
					<AlertDescription>{{ errorMessage }}</AlertDescription>
				</Alert>

				<Button type="submit" :disabled="isSubmitting" class="w-full">
					{{ isSubmitting ? t('auth.submittingRegister') : t('auth.submitRegister') }}
				</Button>

				<p class="text-center text-sm text-muted-foreground">
					{{ t('auth.haveAccount') }}
					<RouterLink :to="{ name: 'login', query: route.query }" class="text-primary hover:underline">
						{{ t('common.signIn') }}
					</RouterLink>
				</p>
			</form>
		</CardContent>
	</Card>
</template>
