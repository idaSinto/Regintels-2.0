import { ArrowRight, ShieldCheck, Activity, Layers } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center">
      
      
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-10" />
        <div className="absolute -bottom-40 -left-40 w-72 h-72 bg-purple-500 rounded-full blur-3xl opacity-10" />
      </div>

      <main className="relative w-full max-w-6xl mx-auto px-6 py-16">
        
        {/* Glass hero container */}
        <section className="rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/40 dark:border-gray-700 shadow-xl p-10 md:p-14">
          
          {/* Version badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 px-4 py-1 text-sm font-medium mb-8">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Regulatory Intelligence Service (Regintels)
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6
            bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Regulatory change detection,<br /> distilled into clarity
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl text-gray-600 dark:text-gray-300 text-lg mb-12">
            Regintels continuously scans, verifies, and summarizes regulatory updates,
            transforming fragmented sources into actionable intelligence.
          </p>

          {/* Feature indicators (technical credibility) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
            <div className="flex items-start gap-4">
              <Activity className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  Continuous Monitoring
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automated scans across regulatory sources
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Layers className="h-6 w-6 text-purple-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  Multi-source Verification
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Confidence scoring based on corroboration
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ShieldCheck className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  Impact Assessment
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  High, medium, and low regulatory impact signals
                </p>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex">
            <a
              href="/login"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-white
              bg-gradient-to-r from-blue-600 to-purple-600
              shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Staff Sign In
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
