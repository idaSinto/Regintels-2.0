import { redirect } from 'next/navigation';
import { ShieldCheck, Activity, Layers } from 'lucide-react';

import AuthAccessPanel from '@/components/auth/AuthAccessPanel';
import { createSupabaseServerClient } from '@/lib/core/supabaseServer';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(126,34,206,0.22),_transparent_32%),linear-gradient(145deg,#020617_0%,#0f172a_48%,#111827_100%)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <div className="absolute -top-40 -right-40 h-72 w-72 rounded-full bg-violet-500 blur-3xl opacity-10" />
        <div className="absolute -bottom-40 -left-40 h-72 w-72 rounded-full bg-fuchsia-500 blur-3xl opacity-10" />
      </div>

      <main className="relative mx-auto flex h-screen w-full max-w-7xl items-center px-6 py-8">
        <section className="w-full rounded-[2rem] border border-slate-700/70 bg-slate-950/55 p-8 shadow-xl backdrop-blur-xl md:p-10 lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
          <div className="grid items-center gap-8 lg:h-full lg:grid-cols-[minmax(0,1.35fr)_420px] lg:gap-12">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-1 text-sm font-medium text-violet-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                Regulatory Intelligence Service (Regintels)
              </div>

              <h1 className="mb-5 bg-gradient-to-r from-blue-500 via-violet-400 to-fuchsia-500 bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-5xl xl:text-6xl">
                Regulatory change detection,<br /> distilled into clarity
              </h1>

              <p className="mb-10 max-w-2xl text-base text-slate-300 xl:text-lg">
                Regintels continuously scans, verifies, and summarizes regulatory updates,
                transforming fragmented sources into actionable intelligence.
              </p>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="flex items-start gap-4">
                  <Activity className="h-6 w-6 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-100">
                      Continuous Monitoring
                    </p>
                    <p className="text-sm text-slate-400">
                      Automated scans across regulatory sources
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Layers className="h-6 w-6 shrink-0 text-violet-400" />
                  <div>
                    <p className="font-semibold text-slate-100">
                      Multi-source Verification
                    </p>
                    <p className="text-sm text-slate-400">
                      Confidence scoring based on corroboration
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-slate-100">
                      Impact Assessment
                    </p>
                    <p className="text-sm text-slate-400">
                      High, medium, and low regulatory impact signals
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full justify-self-end lg:self-center">
              <AuthAccessPanel nextPath="/dashboard" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
