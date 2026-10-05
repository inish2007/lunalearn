'use client';
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, RefreshCw, Sparkles } from 'lucide-react';
export { default as CountUp } from './CountUp';

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">{eyebrow || 'LunaLearn workspace'}</p>
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`glare-hover rounded-3xl border border-highlight/35 bg-card p-5 shadow-soft transition-all duration-300 dark:border-highlight/20 ${className}`}>
      {children}
    </section>
  );
}

export function Progress({ value, color = 'bg-primary' }: { value: number; color?: string }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue} className="h-2 overflow-hidden rounded-full bg-highlight/30 dark:bg-highlight/15">
      <div className={`progress-fill h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function Risk({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 dark:border-purple-900/30 dark:bg-purple-950/30">
      <CircleAlert className="mt-0.5 shrink-0 text-primary" size={19} />
      <div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

export function AcademicDataSkeleton({ label = 'Loading academic data' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="animate-pulse space-y-6">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <div className="h-3 w-36 rounded bg-highlight/60" />
        <div className="h-9 w-64 max-w-full rounded bg-highlight/60" />
        <div className="h-4 w-96 max-w-full rounded bg-highlight/40" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.9fr_.9fr]">
        {[0, 1, 2].map(column => (
          <Card key={column} className="space-y-4 p-5">
            <div className="h-5 w-36 rounded bg-highlight/60" />
            <div className="h-24 rounded-xl bg-highlight/35" />
            <div className="h-4 w-3/4 rounded bg-highlight/45" />
            <div className="h-4 w-1/2 rounded bg-highlight/45" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AcademicDataErrorBanner({
  message,
  actionSuggestion,
  onRetry
}: {
  message: string;
  actionSuggestion?: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <CircleAlert className="mt-0.5 shrink-0 text-red-700 dark:text-red-400" size={20} />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-red-950 dark:text-red-200">Academic data could not be loaded</h2>
          <p className="mt-1 text-sm leading-6 text-red-900 dark:text-red-300">{message}</p>
          {actionSuggestion && <p className="mt-1 text-xs leading-5 text-red-800 dark:text-red-400">{actionSuggestion}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-900 transition hover:bg-red-100 dark:border-red-800 dark:bg-card dark:text-red-300 dark:hover:bg-red-950/50 sm:self-center"
      >
        <RefreshCw size={15} /> Retry
      </button>
    </div>
  );
}

export function TaskRow({ title, meta, done = false }: { title: string; meta: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full border transition-colors ${
          done ? 'border-primary bg-primary text-white' : 'border-highlight/50 bg-card text-muted'
        }`}
      >
        {done && <CheckCircle2 size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${done ? 'text-muted line-through' : 'text-ink'}`}>{title}</p>
        <p className="mt-0.5 text-xs text-muted">{meta}</p>
      </div>
      <ChevronRight className="text-muted" size={17} />
    </div>
  );
}

export function Mission({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`glare-hover relative overflow-hidden rounded-3xl bg-gradient-to-br from-deep via-primary to-accent p-5 text-white shadow-float ${
        compact ? '' : 'md:p-7'
      }`}
    >
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/80">
            <Sparkles size={15} /> Today&apos;s mission
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs">2h 15m</span>
        </div>
        <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-black`}>Stabilize DBMS readiness</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
          Revise Normalization, complete your schema assignment, then take a focused 5-question check-in.
        </p>
        <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-deep shadow-md hover:bg-white/90 transition">
          Start focus session <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}

export const statMeta = [
  { label: 'Study streak', value: '12 days', icon: Clock3 },
  { label: 'Tasks done', value: '18 / 24', icon: CheckCircle2 }
];
