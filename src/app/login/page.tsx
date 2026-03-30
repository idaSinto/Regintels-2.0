import { redirect } from 'next/navigation';
import { LockKeyhole, Orbit, ShieldCheck } from 'lucide-react';

import LoginForm from '@/components/auth/LoginForm';
import { createSupabaseServerClient } from '@/lib/core/supabaseServer';

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function sanitizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith('/')) {
    return '/dashboard';
  }

  return nextPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNextPath(resolvedSearchParams.next);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_30%),linear-gradient(135deg,#f8fafc_0%,#e2e8f0_45%,#dbeafe_100%)] px-6 py-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[10%] top-[15%] h-64 w-64 rounded-full bg-cyan-400/10 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] h-80 w-80 rounded-full bg-blue-700/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <section className="flex flex-col justify-center text-center lg:text-left">
            <div className="mx-auto lg:mx-0 inline-flex w-fit items-center gap-2 rounded-full border border-slate-300/70 bg-white/70 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <Orbit className="h-4 w-4 text-blue-700" />
              Enterprise Monitoring Console
            </div>

            <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Controlled access for regulatory operations teams.
            </h1>

            <p className="mt-6 lg:text-base leading-relaxed text-slate-600 lg:max-w-lg">
              The dashboard is now protected by Supabase sessions. Staff sign in with a managed staff ID
              and password before accessing monitoring, scanning, and newsletter controls.
            </p>

            <div className="mt-10 flex flex-wrap justify-center lg:justify-start gap-4">
              <div className="flex max-w-[260px] items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Protected dashboard routes</p>
                  <p className="mt-1 text-xs text-slate-500">Unauthenticated requests are redirected before protected pages or APIs load.</p>
                </div>
              </div>
              <div className="flex max-w-[260px] items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Staff ID login policy</p>
                  <p className="mt-1 text-xs text-slate-500">Each staff ID is resolved on the server from your staff directory, so staff ID and email can remain completely separate.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="w-full max-w-md shrink-0">
            <LoginForm nextPath={nextPath} />
          </div>

        </div>
      </div>
    </div>
  );
}
