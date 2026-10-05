'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { hasAdminPermission, canAdminCreate, canAdminDelete, type AdminTokenPayload, type AdminPermission } from '@/lib/admin-auth';

export const AdminSessionContext = createContext<AdminTokenPayload | null>(null);
export function useAdminSession() { return useContext(AdminSessionContext); }

export function AdminAccess({ permission, action = 'read', children }: {
  permission: AdminPermission; action?: 'read' | 'write' | 'delete'; children: ReactNode;
}) {
  const user = useAdminSession();
  if (!hasAdminPermission(user, permission)) return null;
  if (action === 'write' && !canAdminCreate(user) || action === 'delete' && !canAdminDelete(user)) return null;
  return children;
}
