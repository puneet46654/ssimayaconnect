export const ADMIN_TOKEN_KEY = 'ssi_admin_token';
export const ADMIN_SESSION_EVENT = 'ssi-admin-session-refresh';

export const ROOT_ADMIN_USERNAME = 'puneet';

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
      !Number.isFinite(payload.loggedInAt) ||
      payload.loggedInAt > Date.now() ||
      Date.now() - payload.loggedInAt > 8 * 60 * 60 * 1000
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
  try { window.localStorage.setItem(ADMIN_TOKEN_KEY, encodeAdminToken(payload)); } catch { /* Server cookies remain authoritative. */ }
}

export function getAdminTokenPayload(): AdminTokenPayload | null {
  if (typeof window === 'undefined') return null;

  let token: string | null;
  try { token = window.localStorage.getItem(ADMIN_TOKEN_KEY); } catch { return null; }
  if (!token) return null;

  const payload = decodeAdminToken(token);
  if (!payload) {
    clearAdminSession();
  }

  return payload;
}

export function hasAdminPermission(
  payload: AdminTokenPayload | null,
  permission: AdminPermission,
): boolean {
  if (!payload) return false;
  // User & Access belongs to the built-in root admin only.
  if (permission === 'auth') return payload.username === ROOT_ADMIN_USERNAME;
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
  try { window.localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* Storage may be disabled. */ }
}

export const ADMIN_PERMISSION_ROUTES: Record<AdminPermission, string> = {
  dashboard: '/admin/landing', events: '/admin/eventmanagement', bookings: '/admin/bookings',
  'check-in': '/admin/check-in', reports: '/admin/reports', auth: '/admin/auth',
};

export function firstAdminRoute(payload: AdminTokenPayload) {
  return Object.entries(ADMIN_PERMISSION_ROUTES).find(([permission]) => hasAdminPermission(payload, permission as AdminPermission))?.[1] || null;
}

/** Notify the admin layout when an API rejects stale authentication or permissions. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (typeof window !== 'undefined' && [401, 403].includes(response.status)) {
    if (response.status === 401) clearAdminSession();
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
  }
  return response;
}
