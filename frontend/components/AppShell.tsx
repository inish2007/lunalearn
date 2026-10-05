'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Target,
  UserRound,
  WandSparkles,
  X
} from 'lucide-react';
import { useAcademic } from '@/lib/context/AcademicContext';
import { ThemeToggle } from '@/components/ThemeToggle';

const primary = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['My Learning', '/learning', BookOpen],
  ['My Materials', '/materials', FolderOpen],
  ['AI Assistant', '/assistant', Bot],
  ['Tasks & Assignments', '/tasks', ClipboardCheck],
  ['Study Planner', '/planner', CalendarDays],
  ['Exams & Readiness', '/exams', Target],
  ['Quizzes', '/quizzes', FileText]
] as const;

const secondary = [
  ['Analytics', '/analytics', ChartNoAxesCombined],
  ['What-If Simulator', '/simulator', WandSparkles],
  ['Learning Profile', '/profile', UserRound],
  ['Notifications', '/notifications', Bell],
  ['Settings', '/settings', Settings]
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { profile, logout, risks } = useAcademic();

  useEffect(() => {
    const spark = (event: MouseEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (let i = 0; i < 6; i++) {
        const particle = document.createElement('i');
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.35;
        const distance = 13 + Math.random() * 14;
        particle.className = 'click-spark';
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        particle.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
        document.body.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
      }
    };
    document.addEventListener('click', spark);
    return () => document.removeEventListener('click', spark);
  }, []);

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  const studentName = profile?.full_name || 'Aarav Patel';
  const studentInitials = studentName
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const studentDegree = `${profile?.course || 'Computer Science'} · Semester ${profile?.semester || 1}`;
  const studentLevel = profile?.level || 1;
  const studentXp = profile?.xp || 0;

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const links = (items: typeof primary | typeof secondary) =>
    items.map(([label, href, Icon]) => (
      <Link
        onClick={() => setOpen(false)}
        href={href}
        key={href}
        className={`pill-nav-effect flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          path === href
            ? 'bg-primary text-white shadow-lg shadow-primary/25'
            : 'text-muted hover:bg-highlight/30 hover:text-ink'
        }`}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    ));

  return (
    <div className="relative min-h-screen bg-canvas text-ink transition-colors duration-300">
      {/* Ambient Living Cosmic Nebula (Dreamy Cozy Atmosphere) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="cosmic-orb -left-20 -top-20 h-[500px] w-[500px] bg-primary/10 dark:bg-primary/18" />
        <div className="cosmic-orb -right-32 top-1/3 h-[580px] w-[580px] bg-accent/8 dark:bg-amber-400/9" />
        <div className="cosmic-orb bottom-10 left-1/4 h-[420px] w-[420px] bg-deep/8 dark:bg-primary/12" />
      </div>

      {/* Mobile Menu Trigger */}
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl border border-highlight/30 bg-surface p-2 text-primary shadow-soft lg:hidden"
      >
        <Menu />
      </button>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-highlight/30 bg-surface p-6 shadow-soft transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-md shadow-primary/30">
              <Sparkles size={19} />
            </span>
            Luna<span className="text-primary">Learn</span>
          </Link>
          <button className="lg:hidden text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X />
          </button>
        </div>

        {/* Real Profile Summary Badge */}
        <div className="mb-5 rounded-3xl border border-highlight/30 bg-gradient-to-br from-highlight/30 to-card p-4 dark:from-highlight/15 dark:to-card">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-deep text-sm font-bold text-white shadow-sm">
              {studentInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-sm text-ink">{studentName}</p>
              <p className="truncate text-xs text-muted">{studentDegree}</p>
            </div>
          </div>
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-highlight/30">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(studentXp % 500) / 5}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">
            Level {studentLevel} · {studentXp.toLocaleString()} XP
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto">
          {links(primary)}
          <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted">Explore</p>
          {links(secondary)}
        </nav>

        {/* Sidebar Footer with Sign Out */}
        <div className="mt-4 border-t border-highlight/30 pt-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-highlight/30 hover:text-red-500 transition"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative z-10 min-h-screen lg:ml-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-end gap-3 border-b border-highlight/30 bg-canvas/80 px-5 backdrop-blur-xl sm:px-8">
          <div className="mr-auto hidden text-sm font-medium text-muted md:block">{todayStr}</div>

          {/* Celestial Theme Toggle (Sun/Moon) */}
          <ThemeToggle />

          <Link
            href="/notifications"
            className="relative grid h-10 w-10 place-items-center rounded-2xl border border-highlight/30 bg-card text-muted shadow-sm hover:border-primary/50 hover:text-primary transition"
          >
            <Bell size={18} />
            {risks.length > 0 && <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary animate-pulse" />}
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-2xl border border-highlight/30 bg-card px-3 py-2 text-sm font-semibold text-ink shadow-sm hover:border-primary/50 transition"
          >
            <span>{studentInitials}</span>
            <ChevronRight size={15} className="text-muted" />
          </Link>
        </header>

        <div className="mx-auto max-w-[1600px] p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
