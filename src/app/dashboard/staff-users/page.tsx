'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

type StaffAccount = {
  id: number;
  staffId: string;
  email: string;
  isActive: boolean;
};

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

export default function StaffUsersPage() {
  const router = useRouter();
  const [staffUsers, setStaffUsers] = useState<StaffAccount[]>([]);
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [rowActionUserId, setRowActionUserId] = useState<number | null>(null);

  async function fetchStaffUsers() {
    setLoading(true);

    try {
      const response = await fetch('/api/staff-users');
      const payload = await parseJsonResponse<StaffAccount[] | { error?: string }>(response);

      if (!response.ok) {
        const errorMessage =
          payload && !Array.isArray(payload) ? payload.error : undefined;
        setError(errorMessage ?? 'Failed to load staff users.');
        return;
      }

      if (!payload || !Array.isArray(payload)) {
        setError('Staff users API did not return valid JSON.');
        return;
      }

      setStaffUsers(payload);
    } catch {
      setError('Failed to load staff users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  function startEditing(user: StaffAccount) {
    setEditingUserId(user.id);
    setEditStaffId(user.staffId);
    setEditEmail(user.email);
    setEditPassword('');
    setError(null);
    setSuccess(null);
  }

  function cancelEditing() {
    setEditingUserId(null);
    setEditStaffId('');
    setEditEmail('');
    setEditPassword('');
  }

  async function handleCreateStaffUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!staffId.trim() || !email.trim() || !password) {
      setError('Staff ID, email, and password are required.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/staff-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: staffId.trim(),
          email: email.trim(),
          password,
        }),
      });

      const payload = await parseJsonResponse<{ staffId?: string; error?: string }>(response);

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to create staff user.');
        return;
      }

      if (!payload?.staffId) {
        setError('Staff creation API did not return valid JSON.');
        return;
      }

      setSuccess(`Created ${payload.staffId} successfully.`);
      setStaffId('');
      setEmail('');
      setPassword('');
      await fetchStaffUsers();
    } catch {
      setError('Failed to create staff user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStaffUser(userId: number) {
    setError(null);
    setSuccess(null);
    setRowActionUserId(userId);

    try {
      const response = await fetch(`/api/staff-users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: editStaffId.trim(),
          email: editEmail.trim(),
          password: editPassword || undefined,
        }),
      });

      const payload = await parseJsonResponse<{ staffId?: string; error?: string }>(response);

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to update staff user.');
        return;
      }

      if (!payload?.staffId) {
        setError('Staff update API did not return valid JSON.');
        return;
      }

      setSuccess(`Updated ${payload.staffId} successfully.`);
      cancelEditing();
      await fetchStaffUsers();
    } catch {
      setError('Failed to update staff user.');
    } finally {
      setRowActionUserId(null);
    }
  }

  async function handleToggleActive(user: StaffAccount) {
    setError(null);
    setSuccess(null);
    setRowActionUserId(user.id);

    try {
      const response = await fetch(`/api/staff-users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      const payload = await parseJsonResponse<{ staffId?: string; isActive?: boolean; error?: string }>(response);

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to update staff status.');
        return;
      }

      if (!payload?.staffId || typeof payload.isActive !== 'boolean') {
        setError('Staff status API did not return valid JSON.');
        return;
      }

      setSuccess(`${payload.staffId} is now ${payload.isActive ? 'active' : 'inactive'}.`);
      await fetchStaffUsers();
    } catch {
      setError('Failed to update staff status.');
    } finally {
      setRowActionUserId(null);
    }
  }

  async function handleDeleteStaffUser(user: StaffAccount) {
    if (!window.confirm(`Delete ${user.staffId}? This also removes the Supabase auth user.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setRowActionUserId(user.id);

    try {
      const response = await fetch(`/api/staff-users/${user.id}`, {
        method: 'DELETE',
      });

      const payload = await parseJsonResponse<{ ok?: boolean; error?: string }>(response);

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to delete staff user.');
        return;
      }

      setSuccess(`Deleted ${user.staffId} successfully.`);
      if (editingUserId === user.id) {
        cancelEditing();
      }
      await fetchStaffUsers();
    } catch {
      setError('Failed to delete staff user.');
    } finally {
      setRowActionUserId(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.32))] w-full flex-col items-center justify-center bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] px-4 py-8">
      <div className="absolute left-1/2 top-0 -z-10 h-full w-full -translate-x-1/2 bg-gradient-to-b from-[var(--secondary)] to-transparent" />

      <div className="container mx-auto">
        <section className="mb-8 w-full px-4">
          <div className="mb-6 flex items-center justify-between">
            <motion.button
              whileHover={{ x: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[var(--foreground)]/70 transition-all hover:bg-white/50 hover:text-[var(--foreground)] dark:hover:bg-gray-800/50"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Dashboard
            </motion.button>
            <div className="inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)]">
              <span className="mr-2 flex h-2 w-2 rounded-full bg-[var(--accent)]" />
              Access Control
            </div>
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
            Staff Users
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--foreground)]/80">
            Create a Supabase Auth user and the staff ID mapping in one step.
          </p>
        </section>

        {(error || success) ? (
          <section className="mb-6 px-4">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-sm">
                {success}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-gray-200/50 bg-white/60 p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--accent)]/10 p-3">
                <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Create Staff User</h2>
                <p className="text-sm text-[var(--foreground)]/70">Provision login and staff mapping together.</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreateStaffUser}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">Staff ID</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <UserRound className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={event => setStaffId(event.target.value)}
                    placeholder="eg. S032029"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">Email</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <Mail className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="staff@prefchem.com.my"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">Temporary Password</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <KeyRound className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Create a strong password"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus className="h-4 w-4" />
                {saving ? 'Creating...' : 'Create Staff User'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200/50 bg-white/60 p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/60">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--accent)]/10 p-3">
                <Building2 className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Existing Staff Users</h2>
                <p className="text-sm text-[var(--foreground)]/70">Recent staff mappings in your local project.</p>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-[var(--foreground)]/70">Loading staff users...</div>
            ) : staffUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-[var(--foreground)]/70 dark:border-gray-600">
                No staff users yet.
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                <div className="grid min-w-[680px] grid-cols-[120px_minmax(220px,1.4fr)_90px_180px] gap-4 border-b border-gray-200/60 bg-white/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60 dark:border-gray-700/60 dark:bg-gray-800/40">
                  <span>Staff ID</span>
                  <span>Email</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {staffUsers.map(user => (
                  <div
                    key={user.id}
                    className="min-w-[680px] border-b border-gray-200/40 px-4 py-3 text-sm text-[var(--foreground)] last:border-b-0 dark:border-gray-700/40"
                  >
                    {editingUserId === user.id ? (
                      <div className="grid grid-cols-[120px_minmax(220px,1.4fr)_90px_180px] gap-4">
                        <input
                          type="text"
                          value={editStaffId}
                          onChange={event => setEditStaffId(event.target.value)}
                          className="rounded-lg border border-gray-300 bg-white/70 px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800/60"
                        />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={event => setEditEmail(event.target.value)}
                          className="rounded-lg border border-gray-300 bg-white/70 px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800/60"
                        />
                        <span className={user.isActive ? 'py-2 text-emerald-600' : 'py-2 text-amber-600'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleUpdateStaffUser(user.id)}
                            disabled={rowActionUserId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-70"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={rowActionUserId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 disabled:opacity-70 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                        <div className="col-span-4">
                          <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                            <KeyRound className="h-4 w-4 text-[var(--foreground)]/50" />
                            <input
                              type="password"
                              value={editPassword}
                              onChange={event => setEditPassword(event.target.value)}
                              placeholder="Optional new password"
                              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--foreground)]/40"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[120px_minmax(220px,1.4fr)_90px_180px] gap-4">
                        <span className="font-medium">{user.staffId}</span>
                        <span className="truncate">{user.email}</span>
                        <span className={user.isActive ? 'text-emerald-600' : 'text-amber-600'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 justify-start">
                          <button
                            onClick={() => startEditing(user)}
                            disabled={rowActionUserId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-70"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={rowActionUserId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-400 disabled:opacity-70"
                          >
                            {user.isActive ? 'Inactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteStaffUser(user)}
                            disabled={rowActionUserId === user.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-70"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
