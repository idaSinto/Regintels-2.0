'use client';

import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';

import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

type AuthAccessPanelProps = {
  nextPath: string;
};

export default function AuthAccessPanel({ nextPath }: AuthAccessPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-violet-400/20 bg-slate-950/80 p-3 shadow-2xl shadow-violet-950/30 backdrop-blur-xl lg:max-h-[calc(100vh-8rem)]">
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/70 p-1">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            mode === 'login'
              ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/30'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <LogIn className="h-4 w-4" />
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            mode === 'signup'
              ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/30'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Sign Up
        </button>
      </div>

      {mode === 'login' ? (
        <LoginForm nextPath={nextPath} embedded />
      ) : (
        <SignupForm nextPath={nextPath} embedded />
      )}
    </div>
  );
}
