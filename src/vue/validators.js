import { email, helpers, minLength, required, url } from '@vuelidate/validators';
import { i18n } from './i18n';

const t = (key, params) => i18n.global.t(key, params);

/** Правила vuelidate с сообщениями из i18n — язык подставляется в момент показа ошибки */
export const rules = {
	required: helpers.withMessage(() => t('validation.required'), required),
	email: helpers.withMessage(() => t('validation.email'), email),
	minLength: (count) => helpers.withMessage(() => t('validation.minLength', { count }), minLength(count)),
	url: helpers.withMessage(() => t('validation.url'), url),
};

/** Первое сообщение об ошибке поля vuelidate */
export function firstError(field) {
	return field?.$errors?.[0]?.$message ?? '';
}
