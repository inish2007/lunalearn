import Link from 'next/link';
import type { SubjectReadiness } from '@/lib/types/academic';

export function ReadinessDetails({ readiness }: { readiness?: SubjectReadiness }) {
  const b = readiness?.basis;
  if (!b) return <p className="text-xs text-muted">Readiness basis unavailable.</p>;
  return <details className="rounded-xl border border-highlight/40 p-3 text-sm">
    <summary className="cursor-pointer font-bold">How is {readiness.readiness_percentage}% calculated?</summary>
    <div className="mt-3 space-y-2 text-muted">
      <p><Link href={`/learning?subject=${readiness.subject_id}`}>Topics (40%)</Link>: {b.topics.completed} of {b.topics.total} completed. Completed ÷ total × 100; no topics = 0%.</p>
      <p><Link href={`/quizzes?subject=${readiness.subject_id}`}>Quiz performance (30%)</Link>: average of {b.quizzes.count} latest attempts (up to {b.quizzes.limit}); no attempts = 0%.</p>
      <p><Link href={`/planner?subject=${readiness.subject_id}`}>Revision activity (20%)</Link>: {b.revision.minutes} of {b.revision.benchmark_minutes} minutes logged in the past seven days, capped at 100%.</p>
      <p>Assignments (10%): {b.assignments.completed} of {b.assignments.total} completed. No assignments = 100% because none are outstanding.</p>
      <p className="text-xs">Each driver is rounded, multiplied by its weight, then the sum is rounded. Updated {new Date(b.calculated_at).toLocaleString()}.</p>
    </div>
  </details>;
}
