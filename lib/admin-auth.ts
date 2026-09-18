export const ADMIN_TOKEN_KEY = 'ssi_admin_token';

export type AdminTokenPayload = {
  username: string;
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

    return {
      username: payload.username,
      loggedInAt: payload.loggedInAt,
    };
  } catch {
    return null;
  }
}

export function getAdminTokenPayload() {
  if (typeof window === 'undefined') return null;

  const token = window.localStorage.getItem(
    ADMIN_TOKEN_KEY,
  );

  if (!token) return null;

  const payload = decodeAdminToken(token);

  if (!payload) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  return payload;
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
