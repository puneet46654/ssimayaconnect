'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  UserPlus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Search,
  LayoutDashboard,
  Calendar,
  Ticket,
  QrCode,
  FileSpreadsheet,

  RefreshCw,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  getAdminTokenPayload,
  canAdminCreate,
  canAdminDelete,
  type AdminTokenPayload,
  type AdminPermission,
  type AdminRole,
} from '@/lib/admin-auth';

type ManagedUser = {
  _id: string;
  username: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  canCreate?: boolean;
  canDelete?: boolean;
  isActive: boolean;
  createdBy?: string;
  lastLoginAt?: string;
  createdAt: string;
};

const AVAILABLE_PERMISSIONS: {
  id: AdminPermission;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Analytics, metrics & key stats',
    icon: LayoutDashboard,
  },
  {
    id: 'events',
    label: 'Events Management',
    description: 'View schedules, dates & slots',
    icon: Calendar,
  },
  {
    id: 'bookings',
    label: 'Bookings',
    description: 'Browse registrations & attendees',
    icon: Ticket,
  },
  {
    id: 'check-in',
    label: 'Check-in Scanner',
    description: 'QR attendance badge scanner',
    icon: QrCode,
  },
  {
    id: 'reports',
    label: 'Reports & Export',
    description: 'Export attendee lists & summaries',
    icon: FileSpreadsheet,
  },
];

type ActivityLog = {
  _id: string;
  admin: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

const ACTIVITY_ACTIONS: { id: string; label: string; className: string }[] = [
  { id: 'login', label: 'Login', className: 'bg-white text-gray-600 border-gray-200' },
  { id: 'logout', label: 'Logout', className: 'bg-white text-gray-600 border-gray-200' },
  { id: 'login_failed', label: 'Failed Login', className: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'create', label: 'Create', className: 'bg-white text-gray-600 border-gray-200' },
  { id: 'update', label: 'Update', className: 'bg-white text-gray-600 border-gray-200' },
  { id: 'delete', label: 'Delete', className: 'bg-white text-gray-600 border-gray-200' },
  { id: 'role_change', label: 'Role / Permission', className: 'bg-white text-gray-600 border-gray-200' },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function AdminAuthManagementPage() {
  const [currentUser, setCurrentUser] = useState<AdminTokenPayload | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all');
  const [privilegeFilter, setPrivilegeFilter] = useState<'all' | 'view_only' | 'can_create' | 'can_delete'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    password: string;
    role: AdminRole;
    permissions: AdminPermission[];
    canCreate: boolean; // default: false (view only)
    canDelete: boolean; // default: false (view only)
    isActive: boolean;
  }>({
    name: '',
    username: '',
    password: '',
    role: 'admin',
    permissions: ['dashboard', 'bookings'],
    canCreate: false,
    canDelete: false,
    isActive: true,
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Delete confirmation
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Login details shown once after create / password reset
  const [savedCredentials, setSavedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    if (!savedCredentials) return;
    try {
      await navigator.clipboard.writeText(
        `Username: ${savedCredentials.username}\nPassword: ${savedCredentials.password}\nLogin: ${window.location.origin}/admin/login`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: details stay visible to copy manually.
    }
  }

  // Activity logs
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logAdminFilter, setLogAdminFilter] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('');
  const [logFromDate, setLogFromDate] = useState('');
  const [logToDate, setLogToDate] = useState('');

  useEffect(() => {
    const payload = getAdminTokenPayload();
    setCurrentUser(payload);
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAdminFilter, logActionFilter, logFromDate, logToDate]);

  async function loadLogs() {
    setLogsLoading(true);
    setLogsError('');
    try {
      const params = new URLSearchParams();
      if (logAdminFilter) params.set('admin', logAdminFilter);
      if (logActionFilter) params.set('action', logActionFilter);
      // Send local-day boundaries as ISO timestamps so the server's timezone doesn't matter
      if (logFromDate) params.set('from', new Date(`${logFromDate}T00:00:00`).toISOString());
      if (logToDate) params.set('to', new Date(`${logToDate}T23:59:59.999`).toISOString());

      const response = await fetch(`/api/admin/activity?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch activity logs');
      }
      setLogs(data.logs || []);
    } catch (err: unknown) {
      setLogsError(err instanceof Error ? err.message : 'Unable to load activity logs.');
    } finally {
      setLogsLoading(false);
    }
  }

  function describeLog(log: ActivityLog) {
    const d = log.details || {};
    const target =
      (d.username && `@${d.username}`) ||
      (d.eventName && `“${d.eventName}”`) ||
      (d.bookingId && `#${d.bookingId}`) ||
      '';
    const changes = d.changes && typeof d.changes === 'object'
      ? Object.keys(d.changes as Record<string, unknown>).join(', ')
      : '';
    const fields = Array.isArray(d.fields) ? (d.fields as string[]).join(', ') : '';
    const extras = [
      changes && `changed: ${changes}`,
      fields && `fields: ${fields}`,
      d.credentialReset ? 'credentials reset' : '',
    ].filter(Boolean).join(' · ');
    if (log.resource === 'auth') return '—';
    return [log.resource.replace('_', ' '), target, extras && `(${extras})`].filter(Boolean).join(' ');
  }

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      setUsers(data.users || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to users API.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingUserId(null);
    setFormData({
      name: '',
      username: '',
      password: '',
      role: 'admin',
      permissions: ['dashboard', 'bookings', 'check-in'],
      canCreate: false, // Default is View Only as requested
      canDelete: false, // Default is View Only as requested
      isActive: true,
    });
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(true);
  }

  function handleOpenEdit(user: ManagedUser) {
    setEditingUserId(user._id);
    const isSuper = user.role === 'superadmin';
    setFormData({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      permissions: [...user.permissions],
      canCreate: isSuper ? true : Boolean(user.canCreate),
      canDelete: isSuper ? true : Boolean(user.canDelete),
      isActive: user.isActive,
    });
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(true);
  }

  function togglePermission(perm: AdminPermission) {
    if (formData.role === 'superadmin') return;
    setFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  }

  function handleRoleChange(newRole: AdminRole) {
    const isSuper = newRole === 'superadmin';
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      canCreate: isSuper ? true : prev.canCreate,
      canDelete: isSuper ? true : prev.canDelete,
      permissions: isSuper
        ? AVAILABLE_PERMISSIONS.map((p) => p.id)
        : prev.permissions,
    }));
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pwd }));
    setShowPassword(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter full name.');
      return;
    }
    if (!editingUserId && !formData.username.trim()) {
      setFormError('Please enter login username.');
      return;
    }
    if (!editingUserId && (!formData.password || formData.password.length < 6)) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (editingUserId && formData.password && formData.password.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }
    if (formData.role !== 'superadmin' && formData.permissions.length === 0) {
      setFormError('Please select at least one sidebar feature access.');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingUserId
        ? `/api/admin/users/${editingUserId}`
        : '/api/admin/users';
      const method = editingUserId ? 'PUT' : 'POST';

      const isSuper = formData.role === 'superadmin';

      const bodyPayload: Record<string, unknown> = {
        name: formData.name.trim(),
        role: formData.role,
        permissions: isSuper
          ? AVAILABLE_PERMISSIONS.map((p) => p.id)
          : formData.permissions,
        canCreate: isSuper ? true : formData.canCreate,
        canDelete: isSuper ? true : formData.canDelete,
        isActive: formData.isActive,
      };

      bodyPayload.username = formData.username.trim().toLowerCase();
      if (formData.password) {
        bodyPayload.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save user.');
      }

      setIsModalOpen(false);
      // Passwords are stored hashed, so this is the only moment they can be shown.
      if (formData.password) {
        setSavedCredentials({
          username: String(bodyPayload.username),
          password: formData.password,
        });
      }
      await loadUsers();
      loadLogs();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userToDelete._id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user.');
      }
      setUserToDelete(null);
      await loadUsers();
      loadLogs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;

      let matchesPrivilege = true;
      const isSuper = u.role === 'superadmin';
      const userCanCreate = isSuper || Boolean(u.canCreate);
      const userCanDelete = isSuper || Boolean(u.canDelete);
      const isViewOnly = !userCanCreate && !userCanDelete;

      if (privilegeFilter === 'view_only') {
        matchesPrivilege = isViewOnly;
      } else if (privilegeFilter === 'can_create') {
        matchesPrivilege = userCanCreate;
      } else if (privilegeFilter === 'can_delete') {
        matchesPrivilege = userCanDelete;
      }

      return matchesSearch && matchesRole && matchesPrivilege;
    });
  }, [users, search, roleFilter, privilegeFilter]);

  const isUserAllowedToCreate = canAdminCreate(currentUser);
  const isUserAllowedToDelete = canAdminDelete(currentUser);

  return (
    <main className="w-full min-w-0 max-w-full overflow-x-hidden pb-10">
      {/* ============================================================
          HEADER
      ============================================================ */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex min-w-0 flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6"
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[22px] font-bold text-secondary sm:text-[24px]">
            Users & Access
          </h1>

          <p className="mt-1 max-w-[650px] text-[11px] leading-[18px] text-gray-500 sm:text-[13px] sm:leading-5">
            Manage admin accounts, roles and permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadUsers}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-secondary active:scale-95"
            title="Refresh Users"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {isUserAllowedToCreate && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenCreate}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-white transition hover:bg-primary-dark"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </motion.button>
          )}
        </div>
      </motion.header>

      {/* ============================================================
          FILTER & SEARCH TOOLBAR
      ============================================================ */}
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-gray-200/90 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-gray-200 bg-[#F6F8FB] pl-9 pr-4 text-xs font-medium text-secondary outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Privilege filter */}
          <select
            value={privilegeFilter}
            onChange={(e) => setPrivilegeFilter(e.target.value as 'all' | 'view_only' | 'can_create' | 'can_delete')}
            className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-3 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
          >
            <option value="all">All Privileges</option>
            <option value="view_only">View only</option>
            <option value="can_create">Can create / edit</option>
            <option value="can_delete">Can delete</option>
          </select>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | AdminRole)}
            className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-3 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================
          USER LIST
      ============================================================ */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
            <p className="mt-3 text-xs font-medium text-gray-500">Retrieving users from MongoDB...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Shield className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-secondary">No matching accounts found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => {
              const isSelf = currentUser?.username === user.username;
              const isSuper = user.role === 'superadmin';
              const userCanCreate = isSuper || Boolean(user.canCreate);
              const userCanDelete = isSuper || Boolean(user.canDelete);
              const isViewOnly = !userCanCreate && !userCanDelete;

              return (
                <div
                  key={user._id}
                  className="flex flex-col gap-3.5 p-4 transition hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  {/* Left: User identity */}
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-100 font-semibold uppercase text-gray-600">
                      {user.name.slice(0, 2)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-secondary text-sm">{user.name}</span>
                        {isSelf && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold uppercase text-primary">
                            You
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {user.role}
                        </span>
                        {!user.isActive && (
                          <span className="rounded-md bg-red-50 px-1.5 py-0.2 text-[9px] font-bold uppercase text-red-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Username: <span className="font-mono font-semibold text-secondary">{user.username}</span>
                      </p>
                    </div>
                  </div>

                  {/* Center: Privileges & Sidebar features */}
                  <div className="flex flex-col gap-2 sm:items-center">
                    {/* Action capability pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isSuper ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          <span>Full access</span>
                        </span>
                      ) : isViewOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          <Eye className="h-3 w-3" />
                          <span>View only</span>
                        </span>
                      ) : (
                        <>
                          {userCanCreate && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                              <Check className="h-3 w-3" />
                              <span>Create / Edit</span>
                            </span>
                          )}
                          {userCanDelete && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                              <Trash2 className="h-3 w-3" />
                              <span>Can Delete</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Sidebar feature pills */}
                    <div className="flex flex-wrap items-center gap-1">
                      {isSuper ? (
                        <span className="text-[10px] text-gray-400 font-medium">All pages</span>
                      ) : (
                        AVAILABLE_PERMISSIONS.map((perm) => {
                          if (!user.permissions.includes(perm.id)) return null;
                          const Icon = perm.icon;
                          return (
                            <span
                              key={perm.id}
                              className="inline-flex items-center gap-1 rounded-md bg-gray-100/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                              title={perm.description}
                            >
                              <Icon className="h-2.5 w-2.5 text-gray-500" />
                              <span>{perm.label}</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-secondary transition hover:border-primary/50 hover:text-primary active:scale-95"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Access</span>
                    </button>

                    {isUserAllowedToDelete && (
                      <button
                        onClick={() => setUserToDelete(user)}
                        disabled={isSelf}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
                        title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
          ADMIN ACTIVITY LOG
      ============================================================ */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-secondary">
              Admin Activity Log
            </h2>
            <p className="text-[11px] text-gray-500">
              Latest 200 admin actions.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLogs}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-secondary active:scale-95"
            title="Refresh Activity"
          >
            <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/90 bg-white p-3.5 shadow-sm">
          <select
            value={logAdminFilter}
            onChange={(e) => setLogAdminFilter(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-3 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
          >
            <option value="">All Admins</option>
            {users.map((u) => (
              <option key={u._id} value={u.username}>
                {u.name} (@{u.username})
              </option>
            ))}
          </select>

          <select
            value={logActionFilter}
            onChange={(e) => setLogActionFilter(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-3 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
          >
            <option value="">All Actions</option>
            {ACTIVITY_ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
            From
            <input
              type="date"
              value={logFromDate}
              max={logToDate || undefined}
              onChange={(e) => setLogFromDate(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-2.5 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
            />
          </label>

          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
            To
            <input
              type="date"
              value={logToDate}
              min={logFromDate || undefined}
              onChange={(e) => setLogToDate(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-[#F6F8FB] px-2.5 text-xs font-semibold text-secondary outline-none transition focus:border-primary/50 focus:bg-white"
            />
          </label>

          {(logAdminFilter || logActionFilter || logFromDate || logToDate) && (
            <button
              type="button"
              onClick={() => {
                setLogAdminFilter('');
                setLogActionFilter('');
                setLogFromDate('');
                setLogToDate('');
              }}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {logsError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            {logsError}
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
          {logsLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-12 text-center text-xs text-gray-400">No activity found for these filters.</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5">Date &amp; Time</th>
                    <th className="px-4 py-2.5">Admin</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const meta = ACTIVITY_ACTIONS.find((a) => a.id === log.action);
                    return (
                      <tr key={log._id} className="hover:bg-gray-50/70">
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-secondary">
                          @{log.admin}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                              meta?.className || 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {meta?.label || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{describeLog(log)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          CREATE / EDIT USER MODAL
      ============================================================ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#07151F]/45 backdrop-blur-[3px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-[24px] border border-gray-200 bg-white p-6 shadow-2xl sm:p-7"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-secondary">
                    {editingUserId ? 'Edit User' : 'Add User'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-secondary"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {/* Full Name & Username */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/70">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Puneet Shukla"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-[#F6F8FB] px-3.5 text-xs font-medium text-secondary outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/70">
                      Login ID / Username
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. puneet"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
                        })
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-[#F6F8FB] px-3.5 text-xs font-medium text-secondary outline-none transition focus:border-primary/50 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/70">
                      {editingUserId ? 'New Password (optional)' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                    >
                      Generate
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUserId}
                      placeholder={editingUserId ? 'Enter a new password to change it' : 'Min 6 characters'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-10 w-full rounded-xl border border-gray-200 bg-[#F6F8FB] px-3.5 pr-10 text-xs font-medium text-secondary outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/70">
                    User Role
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(['admin', 'staff'] as AdminRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRoleChange(r)}
                        className={`rounded-xl border py-2 text-xs font-semibold capitalize transition ${
                          formData.role === r
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ============================================================
                    DATA MODIFICATION PRIVILEGES (POST / DELETE)
                ============================================================ */}
                <div className="rounded-2xl border border-gray-200/90 bg-[#F8FAFC] p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-secondary">Permissions</p>
                    </div>

                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {formData.role === 'superadmin'
                        ? 'Full Control'
                        : !formData.canCreate && !formData.canDelete
                        ? 'View Only'
                        : 'Custom'}
                    </span>
                  </div>

                  {formData.role === 'superadmin' ? (
                    <p className="mt-2 text-[11px] text-gray-600">Superadmins have full access.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {/* Toggle 1: Create & Edit */}
                      <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-2.5">
                        <div className="pr-2">
                          <p className="text-xs font-semibold text-secondary">Can create & edit</p>
                          <p className="text-[10px] text-gray-400">
                            Events, bookings and attendance
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, canCreate: !formData.canCreate })}
                          className={`relative flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                            formData.canCreate ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              formData.canCreate ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Toggle 2: Delete */}
                      <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-2.5">
                        <div className="pr-2">
                          <p className="text-xs font-semibold text-secondary">Can delete</p>
                          <p className="text-[10px] text-gray-400">
                            Events, bookings and users
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, canDelete: !formData.canDelete })}
                          className={`relative flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                            formData.canDelete ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              formData.canDelete ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ============================================================
                    SIDEBAR FEATURE ACCESS
                ============================================================ */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/70">
                      Page access
                    </label>
                    {formData.role !== 'superadmin' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
                            })
                          }
                          className="text-[10px] font-semibold text-primary hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              permissions: ['dashboard'],
                            })
                          }
                          className="text-[10px] font-semibold text-gray-500 hover:underline"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>

                  {formData.role === 'superadmin' ? (
                    <div className="mt-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-[11px] text-gray-600">
                      Superadmins can access every page.
                    </div>
                  ) : (
                    <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => {
                        const isChecked = formData.permissions.includes(perm.id);
                        const Icon = perm.icon;
                        return (
                          <div
                            key={perm.id}
                            onClick={() => togglePermission(perm.id)}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                              isChecked
                                ? 'border-primary/40 bg-primary/[0.04]'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div
                              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded ${
                                isChecked ? 'bg-primary text-white' : 'border border-gray-300'
                              }`}
                            >
                              {isChecked && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {perm.label}
                              </p>
                              <p className="text-[10px] text-gray-400 line-clamp-1">{perm.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Account Active Status */}
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#F6F8FB] p-2.5">
                  <div>
                    <p className="text-xs font-semibold text-secondary">Account Enabled</p>
                    <p className="text-[10px] text-gray-400">Permit this user to log in</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        formData.isActive ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 rounded-xl px-4 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
                  >
                    {isSaving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <span>{editingUserId ? 'Save Changes' : 'Create User'}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          LOGIN DETAILS (shown once)
      ============================================================ */}
      {savedCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSavedCredentials(null)}
            className="absolute inset-0 bg-[#07151F]/45"
          />
          <div className="relative w-full max-w-[380px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h4 className="text-sm font-bold text-secondary">Login details</h4>
            <p className="mt-1 text-xs text-gray-500">
              Share these with the user now. The password can&apos;t be shown again — use Edit to set a new one if it&apos;s lost.
            </p>

            <dl className="mt-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Username</dt>
                <dd className="font-mono font-semibold text-secondary">{savedCredentials.username}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Password</dt>
                <dd className="break-all font-mono font-semibold text-secondary">{savedCredentials.password}</dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSavedCredentials(null)}
                className="h-9 rounded-xl px-4 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Done
              </button>
              <button
                type="button"
                onClick={copyCredentials}
                className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                {copied ? 'Copied' : 'Copy details'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          DELETE CONFIRMATION MODAL
      ============================================================ */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-[#07151F]/45 backdrop-blur-[3px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[400px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-secondary">Confirm Delete User</h4>
                  <p className="text-xs text-gray-500">Permanent action</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-600">
                Are you sure you want to permanently delete user{' '}
                <strong className="text-secondary">@{userToDelete.username}</strong> ({userToDelete.name})?
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="h-9 rounded-xl px-4 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex h-9 items-center justify-center rounded-xl bg-red-600 px-4 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(239,68,68,0.25)] hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
