<script setup>
import { Bot, Film, Image as ImageIcon, LogOut, User } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GenerationType } from '@/lib/neurals';
import { useSession } from '../composables/useSession';

const emit = defineEmits(['navigate']);

const { t } = useI18n();
const route = useRoute();
const { user, isAdmin, signOut } = useSession();

/** Штатные 2 рядом с текстом Inter выглядят жидко, особенно без рамки вокруг значка */
const ICON_STROKE = 2.25;

/**
 * Разделы — типы генерации, по одному на каждый: список за них отбирает бэкенд.
 * Раздел едет в адресе, на него же смотрит подсветка. `match` — «свои» экраны
 * раздела, на которых он остаётся подсвеченным.
 */
const links = [
	{
		name: 'chats',
		type: GenerationType.Images,
		labelKey: `chats.sections.${GenerationType.Images}`,
		icon: ImageIcon,
		match: ['chat', 'chat-new'],
	},
	{
		name: 'chats',
		type: GenerationType.Videos,
		labelKey: `chats.sections.${GenerationType.Videos}`,
		icon: Film,
		match: ['chat', 'chat-new'],
	},
	{
		name: 'chats',
		type: GenerationType.Text,
		labelKey: `chats.sections.${GenerationType.Text}`,
		icon: Bot,
		match: ['chat', 'chat-new'],
		isNew: true,
	},
	{ name: 'profile', labelKey: 'account.nav.profile', icon: User },
];

/**
 * Подсветку считаем сами, а не берём isActive у RouterLink: во-первых, chats/:id лежит
 * соседним маршрутом, а не вложенным, и ссылка на список его не покрывала; во-вторых,
 * все три раздела делят один маршрут и различаются только query.
 */
function isCurrent(link) {
	const inSection = route.name === link.name || (link.match ?? []).includes(route.name);
	if (!inSection) return false;

	// Раздел генерации: на детальной странице его подсказывает адрес
	return link.type ? route.query.type === link.type : true;
}

const initials = computed(() => (user.value?.name ?? '?').trim().charAt(0).toUpperCase());
</script>

<template>
	<!-- Тянемся на всю высоту: в сайдбаре и в выезжающей панели блок пользователя прижат к низу -->
	<div class="flex h-full flex-col gap-4">
		<nav class="grid gap-1">
			<RouterLink
				v-for="link in links"
				:key="link.labelKey"
				v-slot="{ href, navigate }"
				:to="{ name: link.name, query: link.type ? { type: link.type } : undefined }"
				custom
			>
				<a
					:href="href"
					:aria-current="isCurrent(link) ? 'page' : undefined"
					class="flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
					:class="
						isCurrent(link)
							? 'bg-muted font-medium text-foreground'
							: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
					"
					@click="
						navigate($event);
						emit('navigate');
					"
				>
					<component
						:is="link.icon"
						class="size-4.5 shrink-0"
						:stroke-width="ICON_STROKE"
					/>
					<span class="min-w-0 flex-1 truncate font-bold">{{ t(link.labelKey) }}</span>

					<!-- Плашка «new» своим цветом: primary спорил бы с активным разделом -->
					<Badge
						v-if="link.isNew"
						class="shrink-0 border-transparent bg-highlight text-highlight-foreground"
					>
						{{ t('common.badgeNew') }}
					</Badge>
				</a>
			</RouterLink>
		</nav>

		<div class="mt-auto grid gap-4">
			<Separator />

			<div class="flex items-center gap-3">
				<Avatar class="size-9 shrink-0">
					<AvatarImage v-if="user?.image" :src="user.image" :alt="user?.name" />
					<AvatarFallback>{{ initials }}</AvatarFallback>
				</Avatar>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">{{ user?.name }}</p>
					<p class="truncate text-xs text-muted-foreground">{{ user?.email }}</p>
				</div>
				<Badge v-if="isAdmin" variant="secondary">admin</Badge>
			</div>

			<Button variant="outline" size="sm" class="justify-center" @click="signOut">
				<LogOut class="size-4" :stroke-width="ICON_STROKE" />
				{{ t('common.signOut') }}
			</Button>
		</div>
	</div>
</template>
