<script setup>
import useVuelidate from '@vuelidate/core';
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { authClient, authErrorKey } from '@/lib/auth-client';
import FormField from '../components/FormField.vue';
import { useSession } from '../composables/useSession';
import { firstError, rules } from '../validators';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { refresh } = useSession();

const form = reactive({ email: '', password: '' });
const rememberMe = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref('');

const v$ = useVuelidate(
	{
		email: { required: rules.required, email: rules.email },
		password: { required: rules.required, minLength: rules.minLength(8) },
	},
	form,
);

/** Пускаем только внутренние адреса — иначе ?redirect= превращается в открытый редирект */
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

	const { error } = await authClient.signIn.email({
		email: form.email.trim(),
		password: form.password,
		rememberMe: rememberMe.value,
	});

	if (error) {
		errorMessage.value = t(authErrorKey(error) ?? 'errors.generic');
		isSubmitting.value = false;
		return;
	}

	await refresh();
	router.push(safeRedirect());
}
</script>

<template>
	<Card class="bg-card/70 supports-backdrop-filter:backdrop-blur-md">
		<CardHeader>
			<CardTitle class="text-xl">{{ t('auth.loginTitle') }}</CardTitle>
			<CardDescription>{{ t('auth.loginSubtitle') }}</CardDescription>
		</CardHeader>

		<CardContent>
			<form class="grid gap-4" novalidate @submit.prevent="submit">
				<FormField
					v-model="form.email"
					type="email"
					autocomplete="email"
					autofocus
					:label="t('auth.email')"
					:error="firstError(v$.email)"
					@blur="v$.email.$touch()"
				/>

				<FormField
					v-model="form.password"
					type="password"
					autocomplete="current-password"
					:label="t('auth.password')"
					:error="firstError(v$.password)"
					@blur="v$.password.$touch()"
				/>

				<Label class="gap-2 text-sm font-normal text-muted-foreground">
					<input v-model="rememberMe" type="checkbox" class="size-4 accent-primary" />
					{{ t('auth.rememberMe') }}
				</Label>

				<Alert v-if="errorMessage" variant="destructive">
					<AlertDescription>{{ errorMessage }}</AlertDescription>
				</Alert>

				<Button type="submit" :disabled="isSubmitting" class="w-full">
					{{ isSubmitting ? t('auth.submittingLogin') : t('auth.submitLogin') }}
				</Button>

				<p class="text-center text-sm text-muted-foreground">
					{{ t('auth.noAccount') }}
					<RouterLink :to="{ name: 'register', query: route.query }" class="text-primary hover:underline">
						{{ t('common.signUp') }}
					</RouterLink>
				</p>
			</form>
		</CardContent>
	</Card>
</template>
