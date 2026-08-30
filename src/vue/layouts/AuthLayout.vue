<script setup>
import { RouterView } from 'vue-router';
import Brand from '../components/Brand.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
</script>

<template>
	<div class="relative flex min-h-svh flex-col">
		<div class="glow pointer-events-none absolute inset-x-0 top-0 h-[28rem]" aria-hidden="true" />
		<div
			class="glow pointer-events-none absolute inset-x-0 bottom-0 h-80 rotate-180"
			aria-hidden="true"
		/>

		<header class="relative flex items-center justify-between px-6 py-5">
			<Brand />
			<ThemeToggle />
		</header>

		<main class="relative flex flex-1 items-start justify-center px-4 pt-8 pb-20 sm:pt-16">
			<div class="w-full max-w-sm">
				<RouterView />
			</div>
		</main>
	</div>
</template>
