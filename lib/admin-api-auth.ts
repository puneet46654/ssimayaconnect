import { NextResponse } from 'next/server';
import { getAdminSession } from './admin-server-auth';
import type { AdminPermission } from '@/models/AdminUser';

/** Module access and mutation privileges must both be granted. Check-in is its own capability. */
export async function adminAccessError(permission: AdminPermission, action: 'read' | 'write' | 'delete' = 'read') {
  const session = await getAdminSession();
  if (!session) {
    const message = 'Your admin session has expired. Please sign in again.';
    return NextResponse.json({ success: false, message, error: message }, { status: 401 });
  }
  const root = session.role === 'superadmin';
  const allowed = root || session.permissions.includes(permission)
    && (action === 'read' || action === 'write' && session.canCreate || action === 'delete' && session.canDelete);
  if (!allowed) {
    const message = 'You do not have permission for this action.';
    return NextResponse.json({ success: false, message, error: message }, { status: 403 });
  }
  return null;
}
