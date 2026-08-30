/** Форма пользователя и сессии, которую отдаёт better-auth (`/get-session`). */
export interface SessionUser {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	emailVerified: boolean;
	createdAt: string;
	updatedAt: string;
	/** Приходит из плагина admin: defaultRole 'user', adminRoles ['admin'] */
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: string | null;
}

export interface SessionInfo {
	id: string;
	/** SSR-разметка токен не отдаёт — он появляется после запроса сессии из браузера */
	token?: string;
	userId: string;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	impersonatedBy?: string | null;
}

export interface Session {
	user: SessionUser;
	session: SessionInfo;
}
