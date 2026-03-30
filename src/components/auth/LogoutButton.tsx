'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/core/supabaseBrowser';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
