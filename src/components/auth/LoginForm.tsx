'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Building2, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

type LoginFormProps = {
  nextPath: string;
};

export default function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();

  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedStaffId = staffId.trim();
    if (!normalizedStaffId || !password) {
      setError('Staff ID and password are required.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        staffId: normalizedStaffId,
        password,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Invalid staff ID or password.');
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Staff Access
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Sign in to Regintels</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use your assigned staff ID and password. Staff IDs are resolved on the server against your
          organization&apos;s staff directory before the Supabase password check runs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Staff ID</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:bg-white">
            <UserRound className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              autoComplete="username"
              value={staffId}
              onChange={event => setStaffId(event.target.value)}
              placeholder="eg. S032029"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:bg-white">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Signing in...' : 'Sign In'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <Building2 className="h-4 w-4 text-emerald-600" />
          Staff directory lookup
        </div>
        <p className="mt-2">
          The app now looks up the staff email from your staff table and does not derive email from
          the staff ID.
        </p>
      </div>
    </div>
  );
}
