/// <reference types="astro/client" />
/// <reference types="@astrojs/vue/vue-shims" />

declare namespace App {
	interface Locals {
		/** Заполняется в src/middleware.ts на каждый on-demand запрос */
		user: import('./lib/auth-types').SessionUser | null;
		session: import('./lib/auth-types').SessionInfo | null;
	}
}
