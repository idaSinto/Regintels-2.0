'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Activity,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import LogoutButton from '@/components/auth/LogoutButton';

type AppShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Activity;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Latest regulatory updates and scan controls',
    icon: Activity,
  },
  {
    href: '/dashboard/regulations',
    label: 'Manage Regulations',
    shortLabel: 'Regulations',
    description: 'Setup for each regulation',
    icon: Sparkles,
  },
  {
    href: '/dashboard/impact-settings',
    label: 'Impact Rules',
    shortLabel: 'Impact',
    description: 'Control high, medium, and low impact keywords',
    icon: Settings2,
  },
  {
    href: '/dashboard/staff-users',
    label: 'My Account',
    shortLabel: 'Account',
    description: 'Update your profile, and change your password',
    icon: UserRound,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function getPageCopy(pathname: string) {
  if (pathname.startsWith('/dashboard/regulations')) {
    return {
      title: 'GHS Scan Modules',
      subtitle: 'Clickable module management for scan setup, source control, and monitoring status.',
    };
  }

  if (pathname.startsWith('/dashboard/impact-settings')) {
    return {
      title: 'Impact Rules',
      subtitle: 'Define which keywords drive urgency and how updates are prioritized in the system.',
    };
  }

  if (pathname.startsWith('/dashboard/staff-users')) {
    return {
      title: 'My Account',
      subtitle: 'Manage your own access, password, and account details.',
    };
  }

  return {
    title: 'Regulatory Intelligence',
    subtitle: 'Browse, verify, and act on regulatory scan results across desktop and mobile.',
  };
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-2">
      {navItems.map(item => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all ${
              active
                ? 'border-[var(--accent)]/30 bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                : 'border-transparent bg-white/55 text-[var(--foreground)] hover:border-[var(--accent)]/20 hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50'
            }`}
          >
            <div
              className={`mt-0.5 rounded-xl p-2 ${
                active
                  ? 'bg-white/15 text-white'
                  : 'bg-[var(--accent)]/10 text-[var(--accent)] group-hover:bg-[var(--accent)]/15'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-[var(--foreground)]'}`}>
                {item.label}
              </p>
              <p
                className={`mt-1 text-xs leading-relaxed ${
                  active ? 'text-white/75' : 'text-[var(--foreground)]/62'
                }`}
              >
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageCopy = useMemo(() => getPageCopy(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.10),_transparent_38%),linear-gradient(180deg,var(--background),var(--secondary))] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 border-r border-slate-200/60 bg-white/70 px-6 py-6 backdrop-blur xl:flex xl:flex-col dark:border-slate-700/60 dark:bg-slate-950/35">
          <div className="mb-8">
            <div className="inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Regintels
            </div>
            <h2 className="mt-4 text-2xl font-bold">Navigation</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]/68">
              Each module links to a specific workflow so the interface stays obvious and functional.
            </p>
          </div>

          <SidebarNav pathname={pathname} />

          <div className="mt-auto space-y-4 rounded-3xl border border-slate-200/60 bg-white/75 p-5 dark:border-slate-700/60 dark:bg-slate-900/45">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Responsive Shell</p>
                <p className="text-xs text-[var(--foreground)]/65">Desktop sidebar, mobile-friendly navigation.</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/45">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  System Workspace
                </p>
                <h1 className="truncate text-xl font-bold sm:text-2xl">{pageCopy.title}</h1>
                <p className="mt-1 hidden max-w-2xl text-sm text-[var(--foreground)]/70 md:block">
                  {pageCopy.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/regulations"
                  className="hidden rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15 md:inline-flex"
                >
                  Open Modules
                </Link>
                <div className="hidden xl:block">
                  <LogoutButton />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/60 bg-white/80 text-[var(--foreground)] transition hover:border-[var(--accent)]/20 hover:text-[var(--accent)] xl:hidden dark:border-slate-700/60 dark:bg-slate-900/50"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

          <nav className="sticky bottom-0 z-30 border-t border-slate-200/70 bg-white/92 px-2 py-2 backdrop-blur xl:hidden dark:border-slate-700/70 dark:bg-slate-950/88">
            <div className="grid grid-cols-4 gap-2">
              {navItems.map(item => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'text-[var(--foreground)]/65 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]'
                    }`}
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    {item.shortLabel}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 xl:hidden"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-slate-200/60 bg-[var(--background)] p-5 shadow-2xl dark:border-slate-700/60"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    Menu
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Navigate Modules</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/60 bg-white/70 transition hover:text-[var(--accent)] dark:border-slate-700/60 dark:bg-slate-900/50"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <SidebarNav pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />

              <div className="mt-auto pt-5">
                <LogoutButton />
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
