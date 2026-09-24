export const ADMIN_TOKEN_KEY = 'ssi_admin_token';

export type AdminRole = 'superadmin' | 'admin' | 'staff';

export type AdminPermission =
  | 'dashboard'
  | 'events'
  | 'bookings'
  | 'check-in'
  | 'reports'
  | 'auth';

export type AdminTokenPayload = {
  username: string;
  name?: string;
  role?: AdminRole;
  permissions: AdminPermission[];
  canCreate: boolean; // default false
  canDelete: boolean; // default false
  loggedInAt: number;
};

export function decodeAdminToken(
  token: string,
): AdminTokenPayload | null {
  try {
    const payload = JSON.parse(
      decodeURIComponent(atob(token)),
    ) as Partial<AdminTokenPayload>;

    if (
      typeof payload.username !== 'string' ||
      typeof payload.loggedInAt !== 'number' ||
      !payload.username ||
      !Number.isFinite(payload.loggedInAt)
    ) {
      return null;
    }

    const isSuper = payload.role === 'superadmin';

    return {
      username: payload.username,
      name: payload.name || payload.username,
      role: (payload.role as AdminRole) || 'admin',
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as AdminPermission[])
        : ['dashboard'],
      canCreate: isSuper ? true : Boolean(payload.canCreate),
      canDelete: isSuper ? true : Boolean(payload.canDelete),
      loggedInAt: payload.loggedInAt,
    };
  } catch {
    return null;
  }
}

export function encodeAdminToken(payload: AdminTokenPayload): string {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function saveAdminSession(payload: AdminTokenPayload): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, encodeAdminToken(payload));
}

export function getAdminTokenPayload(): AdminTokenPayload | null {
  if (typeof window === 'undefined') return null;

  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null;

  const payload = decodeAdminToken(token);
  if (!payload) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  return payload;
}

export function hasAdminPermission(
  payload: AdminTokenPayload | null,
  permission: AdminPermission,
): boolean {
  if (!payload) return false;
  if (payload.role === 'superadmin') return true;
  return payload.permissions.includes(permission);
}

export function canAdminCreate(payload: AdminTokenPayload | null): boolean {
  if (!payload) return false;
  if (payload.role === 'superadmin') return true;
  return Boolean(payload.canCreate);
}

export function canAdminDelete(payload: AdminTokenPayload | null): boolean {
  if (!payload) return false;
  if (payload.role === 'superadmin') return true;
  return Boolean(payload.canDelete);
}

export function isViewOnlyAdmin(payload: AdminTokenPayload | null): boolean {
  if (!payload) return true;
  if (payload.role === 'superadmin') return false;
  return !payload.canCreate && !payload.canDelete;
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
