'use client';
import { ReadinessDetails } from './ReadinessDetails';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target
} from 'lucide-react';
import { useAcademic } from '@/lib/context/AcademicContext';
import { AcademicDataErrorBanner, AcademicDataSkeleton, Card, PageHeader, Progress, Risk, TaskRow } from './Ui';

export function Dashboard() {
  const {
    profile,
    subjects,
    tasks,
    exams,
    readinessMap,
    risks,
    plannerContext,
    createSubject,
    asyncState,
    refreshAll
  } = useAcademic();

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubColor, setNewSubColor] = useState('#4B2DB8');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const studentFirstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'there';

  if (asyncState.status === 'idle' || asyncState.status === 'loading' || asyncState.status === 'retrying') {
    return <AcademicDataSkeleton label="Loading your dashboard" />;
  }

  if (asyncState.status === 'error') {
    return (
      <AcademicDataErrorBanner
        message={asyncState.error?.userMessage || asyncState.error?.message || 'Your academic records could not be synchronized.'}
        actionSuggestion={asyncState.error?.actionSuggestion}
        onRetry={() => { void refreshAll(); }}
      />
    );
  }

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setIsSubmitting(true);
    try {
      await createSubject({
        name: newSubName.trim(),
        code: newSubCode.trim() || newSubName.substring(0, 4).toUpperCase(),
        color: newSubColor
      });
      setNewSubName('');
      setNewSubCode('');
      setShowAddSubjectModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // STATE A: ZERO SUBJECTS (Clean First-Time Empty State)
  // --------------------------------------------------------------------------
  if (subjects.length === 0) {
    return (
      <div className="page-fade space-y-6">
        <PageHeader
          eyebrow="Your academic navigator"
          title={`Good day, ${studentFirstName}!`}
          description="Your academic workspace is ready, nothing has been added yet, start by adding your first subject."
          action={
            <button
              onClick={() => setShowAddSubjectModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-deep transition"
            >
              <Plus size={17} /> Add your first subject
            </button>
          }
        />

        {/* First Subject Prompt Banner */}
        <Card className="p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-purple-50 text-primary">
            <BookOpen size={32} />
          </div>
          <h2 className="mt-5 text-xl font-bold">Your academic workspace is ready</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted leading-relaxed">
            Nothing has been added yet. Add a syllabus subject to activate exam readiness scoring, intelligent deadline tracking, and personalized daily missions.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setShowAddSubjectModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-deep transition"
            >
              <Plus size={17} /> Add Subject
            </button>
            <Link
              href="/learning"
              className="inline-flex items-center gap-2 rounded-xl border border-highlight px-5 py-3 text-sm font-bold text-deep hover:bg-highlight/30 transition"
            >
              Go to Syllabus Navigator <ArrowRight size={16} />
            </Link>
          </div>
        </Card>

        {/* Modal for Quick Subject Creation */}
        {showAddSubjectModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-card border border-highlight/40 p-6 shadow-2xl text-ink">
              <h3 className="text-xl font-bold">Add Subject</h3>
              <p className="mt-1 text-xs text-muted">Register a syllabus course for this semester.</p>

              <form onSubmit={handleAddSubject} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted">Course Name</label>
                  <input
                    value={newSubName}
                    onChange={e => {
                      setNewSubName(e.target.value);
                      if (!newSubCode) setNewSubCode(e.target.value.substring(0, 4).toUpperCase());
                    }}
                    required
                    placeholder="e.g. Database Management Systems"
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted">Course Code</label>
                  <input
                    value={newSubCode}
                    onChange={e => setNewSubCode(e.target.value)}
                    required
                    placeholder="e.g. CS-401"
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted">Accent Color</label>
                  <div className="mt-2 flex gap-3">
                    {['#4B2DB8', '#7C3AED', '#D946EF', '#2563EB', '#059669', '#EA580C'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSubColor(c)}
                        className={`h-7 w-7 rounded-full transition ${newSubColor === c ? 'ring-4 ring-primary/30 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddSubjectModal(false)}
                    className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Adding...' : 'Save Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STATE B: SUBJECTS EXIST (Real Live Data Driven Dashboard)
  // --------------------------------------------------------------------------

  // Nearest upcoming exam calculation
  const now = new Date();
  const sortedExams = [...exams].sort(
    (a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
  );
  const nearestExam = sortedExams[0];

  let nearestExamDaysAway: number | null = null;
  if (nearestExam) {
    const diffMs = new Date(nearestExam.exam_date).getTime() - now.getTime();
    nearestExamDaysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  // Active readiness for the primary subject / nearest exam
  const primarySubjectId = nearestExam?.subject_id || subjects[0]?.id;
  const primarySubject = subjects.find(s => s.id === primarySubjectId) || subjects[0];
  const primaryReadiness = readinessMap[primarySubjectId];
  const hasCalculableReadiness =
    primaryReadiness &&
    typeof primaryReadiness.readiness_percentage === 'number' &&
    (primaryReadiness.breakdown.topic_completion > 0 ||
      primaryReadiness.breakdown.quiz_performance > 0 ||
      primaryReadiness.breakdown.revision_activity > 0);

  // Incomplete priority tasks
  const pendingTasks = tasks.filter(t => !t.is_completed);

  return (
    <div className="page-fade space-y-6">
      <PageHeader
        eyebrow="Your academic navigator"
        title={`Good day, ${studentFirstName}!`}
        description={
          nearestExam
            ? `${primarySubject?.name || 'Your course'} is in focus today. Review your priorities to maintain exam momentum.`
            : 'You are on track. Continue advancing through your course topics and commitments.'
        }
        action={
          <Link
            href="/planner"
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-deep transition inline-flex items-center gap-2"
          >
            <Sparkles size={16} /> View today&apos;s plan
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.9fr_.9fr]">
        {/* ================================================================= */}
        {/* COLUMN 1: Daily Mission & Subject Progress                        */}
        {/* ================================================================= */}
        <div className="space-y-5">
          {/* Mission Card */}
          <div className="glare-hover relative overflow-hidden rounded-3xl bg-gradient-to-br from-deep via-primary to-accent p-6 text-white shadow-float md:p-7">
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/70">
                  <Sparkles size={15} /> Today&apos;s mission
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
                  {plannerContext?.student?.study_time_settings?.preferred_focus_time || 'Daily Focus'}
                </span>
              </div>
              <h2 className="text-2xl font-black">
                {nearestExam
                  ? `Prepare for ${primarySubject?.code || primarySubject?.name}`
                  : `Advance ${primarySubject?.name}`}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/80">
                {nearestExam
                  ? `Focus on weak topics and pending assignments before your exam in ${nearestExamDaysAway} days.`
                  : `Work through your syllabus units and log your practice sessions to build readiness.`}
              </p>
              <Link
                href="/planner"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-deep hover:bg-purple-50 transition"
              >
                Open study timeline <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <ReadinessDetails readiness={primaryReadiness} />
          {/* Subject Progress List */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Subject progress</h2>
                <p className="mt-0.5 text-xs text-muted">Real syllabus topic completion</p>
              </div>
              <Link href="/learning" className="text-xs font-bold text-primary hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-highlight/25">
              {subjects.map(s => {
                const r = readinessMap[s.id];
                const topicCompletion = r?.breakdown?.topic_completion || 0;
                return (
                  <div className="py-3 first:pt-0 last:pb-0" key={s.id}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-semibold">
                        <span className="font-bold mr-1.5" style={{ color: s.color }}>
                          {s.code}
                        </span>
                        {s.name}
                      </span>
                      <span className="font-bold text-primary">{topicCompletion}%</span>
                    </div>
                    <Progress value={topicCompletion} color="bg-primary" />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ================================================================= */}
        {/* COLUMN 2: Priorities, Readiness Gauge & Risk Alerts              */}
        {/* ================================================================= */}
        <div className="space-y-5">
          {/* Today's Priorities */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Today&apos;s priorities</h2>
                <p className="mt-0.5 text-xs text-muted">Upcoming commitments</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-highlight/45 text-primary">
                <Target size={18} />
              </span>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                You&apos;re all caught up, no tasks have been created yet
              </div>
            ) : (
              <div className="divide-y divide-highlight/25">
                {pendingTasks.slice(0, 3).map(t => {
                  const sub = subjects.find(s => s.id === t.subject_id);
                  const dueLabel = t.due_date
                    ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'No deadline';
                  return (
                    <TaskRow
                      key={t.id}
                      title={t.title}
                      meta={`${sub?.code || 'Task'} · Due ${dueLabel}`}
                    />
                  );
                })}
              </div>
            )}

            <Link href="/tasks" className="mt-3 flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              See all tasks <ArrowRight size={14} />
            </Link>
          </Card>

          {/* Exam Readiness Card (Never fabricate percentages) */}
          <Card className="bg-gradient-to-br from-card via-card to-highlight/30">
            {nearestExam ? (
              hasCalculableReadiness ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">Exam readiness</p>
                      <h2 className="mt-1 text-xl font-black">{nearestExam.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {nearestExamDaysAway} day{nearestExamDaysAway === 1 ? '' : 's'} remaining
                      </p>
                    </div>
                    <div className="pulse-ring grid h-24 w-24 place-items-center rounded-full border-[9px] border-highlight bg-surface">
                      <strong className="text-2xl text-deep dark:text-accent">
                        {primaryReadiness.readiness_percentage}%
                      </strong>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress value={primaryReadiness.readiness_percentage} color="bg-gradient-to-r from-deep to-accent" />
                  </div>
                  <Link className="mt-4 flex items-center text-xs font-bold text-primary hover:underline" href="/exams">
                    See readiness breakdown <ChevronRight size={14} />
                  </Link>
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Readiness Profile</p>
                  <h3 className="mt-2 font-bold text-base">{nearestExam.title}</h3>
                  <p className="mt-2 text-xs text-muted max-w-xs mx-auto">
                    Not enough data yet, complete topics or take a quiz to build your readiness profile
                  </p>
                  <Link href="/learning" className="mt-4 inline-block text-xs font-bold text-primary hover:underline">
                    Work on topics →
                  </Link>
                </div>
              )
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Upcoming exams</p>
                <p className="mt-2 text-sm font-semibold text-deep">No upcoming exams</p>
                <p className="mt-1 text-xs text-muted">Schedule an exam to activate countdowns and readiness analysis.</p>
                <Link href="/exams" className="mt-3 inline-block text-xs font-bold text-primary hover:underline">
                  + Schedule exam
                </Link>
              </div>
            )}
          </Card>

          {/* Reasoned Risk Alerts (Exact objects only, never fabricated) */}
          {risks.length === 0 ? (
            <Risk
              label="All clear"
              detail="No academic risks detected, add exams and deadlines to activate risk monitoring"
            />
          ) : (
            <div className="space-y-3">
              {risks.slice(0, 2).map((r, i) => (
                <Risk
                  key={i}
                  label={
                    r.type === 'HIGH_EXAM_RISK'
                      ? 'High-priority exam risk'
                      : r.type === 'DEADLINE_RISK'
                      ? 'Deadline alert'
                      : r.type === 'WORKLOAD_RISK'
                      ? 'Workload conflict'
                      : 'Performance notice'
                  }
                  detail={r.reason}
                />
              ))}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* COLUMN 3: Upcoming Exams & Quick Actions                          */}
        {/* ================================================================= */}
        <div className="space-y-5">
          {/* Upcoming Exams List */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Upcoming exams</h2>
                <p className="mt-0.5 text-xs text-muted">Target dates</p>
              </div>
              <CalendarClock className="text-primary" size={20} />
            </div>

            {exams.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                No upcoming exams
              </div>
            ) : (
              <div className="space-y-3">
                {exams.map(e => {
                  const sub = subjects.find(s => s.id === e.subject_id);
                  const diffMs = new Date(e.exam_date).getTime() - now.getTime();
                  const daysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  const r = readinessMap[e.subject_id];

                  return (
                    <div className="rounded-2xl bg-canvas p-3.5" key={e.id}>
                      <div className="flex justify-between">
                        <p className="text-sm font-bold truncate pr-2">{e.title}</p>
                        <span className="text-xs font-bold text-primary shrink-0">
                          {daysAway}d
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(e.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {sub?.code || 'Course'}
                      </p>
                      {r && typeof r.readiness_percentage === 'number' && (
                        <div className="mt-3 flex items-center gap-2">
                          <Progress value={r.readiness_percentage} />
                          <span className="text-xs font-bold">{r.readiness_percentage}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Actions Tile */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Quick actions</h2>
                <p className="mt-0.5 text-xs text-muted">Pick up where you left off</p>
              </div>
              <MoreHorizontal size={19} className="text-muted" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/assistant"
                className="rounded-2xl bg-highlight/35 p-4 text-sm font-bold text-deep hover:bg-highlight/50 transition flex flex-col justify-between"
              >
                <BookOpen className="mb-3 text-primary" size={20} />
                <span>Ask AI</span>
              </Link>
              <Link
                href="/quizzes"
                className="rounded-2xl bg-purple-50 p-4 text-sm font-bold text-deep hover:bg-purple-100 transition flex flex-col justify-between"
              >
                <CheckCircle2 className="mb-3 text-primary" size={20} />
                <span>Take quiz</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
