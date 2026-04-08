'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, KeyRound, Mail, ShieldCheck, Trash2, UserRound, AlertTriangle, Eye, EyeOff } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/core/supabaseBrowser';
import type { StaffAccountRecord } from '@/lib/core/supabaseAdmin';

type ApiResponse = {
  error?: string;
  ok?: boolean;
  id?: number;
  staffId?: string;
  email?: string;
  isActive?: boolean;
};

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

function isStaffAccount(
  payload: StaffAccountRecord | ApiResponse | null,
): payload is StaffAccountRecord {
  return Boolean(
    payload &&
      typeof payload.id === 'number' &&
      typeof payload.staffId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.isActive === 'boolean',
  );
}

type ProfileSettingsClientProps = {
  initialAccount: StaffAccountRecord;
};

export default function ProfileSettingsClient({ initialAccount }: ProfileSettingsClientProps) {
  const [account, setAccount] = useState<StaffAccountRecord>(initialAccount);
  const [staffId, setStaffId] = useState(initialAccount.staffId);
  const [email, setEmail] = useState(initialAccount.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!staffId.trim() || !email.trim()) {
      setError('Staff ID and email are required.');
      return;
    }

    if (newPassword && !currentPassword) {
      setError('Current password is required before setting a new password.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/staff-users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: staffId.trim(),
          email: email.trim(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const payload = await parseJsonResponse<StaffAccountRecord | ApiResponse>(response);

      if (response.status === 401) {
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        setError(
          payload && !Array.isArray(payload) && 'error' in payload
            ? payload.error ?? 'Failed to update account.'
            : 'Failed to update account.',
        );
        return;
      }

      if (!isStaffAccount(payload)) {
        setError('Account update API did not return valid JSON.');
        return;
      }

      setAccount(payload);
      setStaffId(payload.staffId);
      setEmail(payload.email);
      setCurrentPassword('');
      setNewPassword('');
      setError(null);
      setSuccess('Account updated successfully.');
    } catch {
      setError('Failed to update account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/staff-users', {
        method: 'DELETE',
      });

      const payload = await parseJsonResponse<ApiResponse>(response);

      if (response.status === 401) {
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to delete account.');
        return;
      }

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      setError('Failed to delete account.');
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  }

  return (
    <div className="w-full">
      <AnimatePresence>
        {isDeleteModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 20 }}
              className="relative w-full max-w-md rounded-3xl border border-white/20 bg-slate-950 p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">Delete your account?</h3>
                <p className="mb-8 text-sm text-slate-300">
                  This will permanently remove your Regintels access and delete the linked staff account.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-70"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl flex-1">
        <section className="mb-8 w-full px-1 sm:px-2">
          <div className="mb-6 inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)]">
            <span className="mr-2 flex h-2 w-2 rounded-full bg-[var(--accent)]" />
            Profile Settings
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
            My Account
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--foreground)]/80">
            View, update, or delete the account you are currently signed in with.
          </p>
        </section>

        {(error || success) ? (
          <section className="mb-6 px-1 sm:px-2">
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

        <section className="mx-1 rounded-2xl border border-gray-200/50 bg-white/60 p-6 shadow-sm sm:mx-2 dark:border-gray-700/50 dark:bg-gray-800/60">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[var(--accent)]/10 p-3">
              <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Profile Settings</h2>
              <p className="text-sm text-[var(--foreground)]/70">Only your own account details are shown here.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">Staff ID</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <UserRound className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={event => setStaffId(event.target.value)}
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
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">Current Password</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <KeyRound className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    placeholder="Required before changing password"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(value => !value)}
                    className="text-[var(--foreground)]/50 transition hover:text-[var(--foreground)]"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]/70">New Password</span>
                <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/50">
                  <KeyRound className="h-4 w-4 text-[var(--foreground)]/50" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    placeholder="New password atleast 6 character"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(value => !value)}
                    className="text-[var(--foreground)]/50 transition hover:text-[var(--foreground)]"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200/60 bg-white/40 p-5 dark:border-gray-700/60 dark:bg-gray-900/30">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/50">Account status</p>
                  <p className={`mt-2 text-sm font-semibold ${account.isActive ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/50">Password policy</p>
                  <p className="mt-2 text-sm text-[var(--foreground)]/70">
                    A new password is optional, but the current password must be entered correctly before it can be changed.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={deleting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-70"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
