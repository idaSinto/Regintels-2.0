'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

type SignupFormProps = {
  nextPath: string;
  embedded?: boolean;
};

type ApiError = {
  error?: string;
};

export default function SignupForm({ nextPath, embedded = false }: SignupFormProps) {
  const router = useRouter();
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    router.prefetch(nextPath);
  }, [nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedStaffId = staffId.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedStaffId || !normalizedEmail || !password) {
      setError('Staff ID, email, and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);

    try {
      const signupResponse = await fetch('/api/auth/staff-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: normalizedStaffId,
          email: normalizedEmail,
          password,
          confirmPassword,
        }),
      });

      if (!signupResponse.ok) {
        const payload = (await signupResponse.json().catch(() => null)) as ApiError | null;
        setError(payload?.error ?? 'Failed to create account.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to sign up right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? 'p-4' : 'w-full max-w-md rounded-[2rem] border border-violet-400/20 bg-slate-950/80 p-8 shadow-2xl shadow-violet-950/30 backdrop-blur-xl'}>
      <div className={embedded ? 'mb-5' : 'mb-8'}>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-sm font-medium text-violet-200">
          <ShieldCheck className="h-4 w-4" />
          Regintels Access
        </div>
        <h1 className={embedded ? 'text-2xl font-bold tracking-tight text-white' : 'text-3xl font-bold tracking-tight text-white'}>
          Create your Regintels account
        </h1>
        <p className={embedded ? 'mt-2 text-sm leading-7 text-slate-300' : 'mt-3 text-sm leading-6 text-slate-300'}>
          Use the same staff credentials pattern as sign in. 
        </p>
      </div>

      <form onSubmit={handleSubmit} className={embedded ? 'space-y-3.5' : 'space-y-5'}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Staff ID</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 focus-within:border-violet-400 focus-within:bg-slate-900">
            <UserRound className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoComplete="username"
              value={staffId}
              onChange={event => setStaffId(event.target.value)}
              placeholder="eg. S032029"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 focus-within:border-violet-400 focus-within:bg-slate-900">
            <Mail className="h-4 w-4 text-slate-400" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="staff@regintels.com"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 focus-within:border-violet-400 focus-within:bg-slate-900">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Create a password"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className="text-slate-400 transition hover:text-violet-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Confirm Password</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 focus-within:border-violet-400 focus-within:bg-slate-900">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(value => !value)}
              className="text-slate-400 transition hover:text-violet-200"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-70 ${
            embedded ? 'py-3' : 'py-3.5'
          }`}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
