'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Sparkles,
  FileText,
  Upload,
  Plus,
  Loader2,
  BookOpen
} from 'lucide-react';
import { useAcademic } from '@/lib/context/AcademicContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, createSubject, createUnit, createTopic, importSyllabus } = useAcademic();

  // Auth form state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState(4);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding flow state (activated if user has 0 subjects)
  const [onboardingActive] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);

  // Onboarding subject state
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectColor, setSubjectColor] = useState('#4B2DB8');
  const [createdSubjectId, setCreatedSubjectId] = useState<string | null>(null);

  // Syllabus import vs manual
  const [importMode, setImportMode] = useState<'import' | 'manual'>('import');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingSyllabus, setProcessingSyllabus] = useState(false);
  const [syllabusStatus, setSyllabusStatus] = useState('');

  // Manual units & topics
  const [manualUnitTitle, setManualUnitTitle] = useState('');
  const [manualTopicTitle, setManualTopicTitle] = useState('');
  const [manualAddedList, setManualAddedList] = useState<{ unit: string; topics: string[] }[]>([]);

  // --------------------------------------------------------------------------
  // Handle Authentication Submission
  // --------------------------------------------------------------------------
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!email || !password) throw new Error('Email and password are required');
        await signup({
          email,
          password,
          full_name: fullName || 'New Student',
          course,
          semester: Number(semester)
        });
      } else {
        if (!email || !password) throw new Error('Email and password are required');
        await login(email, password);
      }

      // Navigate straight to the workspace. The Dashboard renders a dedicated
      // "add your first subject" empty state for brand-new accounts, so we
      // don't rely on the (stale) subjects closure here to decide onboarding.
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Onboarding Step 2: Create First Subject
  // --------------------------------------------------------------------------
  const handleCreateFirstSubject = async () => {
    if (!subjectName.trim()) return;
    setSubmitting(true);
    try {
      const sub = await createSubject({
        name: subjectName.trim(),
        code: subjectCode.trim() || subjectName.substring(0, 4).toUpperCase(),
        color: subjectColor
      });
      setCreatedSubjectId(sub.id);
      setOnboardingStep(3);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Failed to create subject');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Onboarding Step 3A: Upload real syllabus PDF
  // --------------------------------------------------------------------------
  const handleProcessSyllabus = async () => {
    if (!createdSubjectId) return;
    setProcessingSyllabus(true);
    setSyllabusStatus('Uploading syllabus document...');

    try {
      if (!uploadedFile) throw new Error('Select a PDF file first.');
      await importSyllabus(createdSubjectId, uploadedFile);
      setSyllabusStatus('PDF uploaded. Add your units and topics in My Learning.');
      router.push('/learning');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Error processing syllabus');
      setProcessingSyllabus(false);
    }
  };

  // --------------------------------------------------------------------------
  // Onboarding Step 3B: Manual Add Unit & Topic
  // --------------------------------------------------------------------------
  const handleAddManualUnitAndTopic = async () => {
    if (!createdSubjectId || !manualUnitTitle.trim()) return;
    setSubmitting(true);
    try {
      const u = await createUnit({
        subject_id: createdSubjectId,
        unit_number: manualAddedList.length + 1,
        title: manualUnitTitle.trim()
      });

      if (manualTopicTitle.trim()) {
        await createTopic({
          unit_id: u.id,
          title: manualTopicTitle.trim(),
          status: 'not_started',
          is_weak: false,
          mastery_score: 0
        }, createdSubjectId);
      }

      setManualAddedList(prev => [
        ...prev,
        { unit: manualUnitTitle.trim(), topics: manualTopicTitle ? [manualTopicTitle.trim()] : [] }
      ]);
      setManualUnitTitle('');
      setManualTopicTitle('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Failed to add unit/topic');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-canvas lg:grid-cols-2">
      {/* Decorative Orbs */}
      <div className="gradient-orb absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-pink-300 pointer-events-none" />
      <div className="gradient-orb absolute right-0 top-0 h-96 w-96 rounded-full bg-primary pointer-events-none" />

      {/* Brand Hero Sidebar */}
      <section className="relative hidden flex-col justify-between bg-gradient-to-br from-deep via-primary to-accent p-12 text-white lg:flex">
        <Link href="/login" className="flex items-center gap-2 text-2xl font-black">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
            <Sparkles size={20} />
          </span>
          LunaLearn
        </Link>
        <div>
          <span className="text-xs font-bold uppercase tracking-[.2em] text-white/70">
            Don&apos;t just manage. Navigate.
          </span>
          <h2 className="mt-5 max-w-lg text-5xl font-black leading-tight">
            Make every study hour count.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/75">
            LunaLearn turns your academic data into calm, useful guidance — so you always know what to do next.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-white/80">
            <Check className="rounded-full bg-white/20 p-1" size={21} /> Personalized daily missions
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <Check className="rounded-full bg-white/20 p-1" size={21} /> Deterministic readiness calculations
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <Check className="rounded-full bg-white/20 p-1" size={21} /> Early reasoned risk detection
          </div>
        </div>
      </section>

      {/* Main Interactive Form Column */}
      <section className="relative grid place-items-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-7 shadow-float backdrop-blur sm:p-9">
          
          {/* ================================================================= */}
          {/* ONBOARDING FLOW FOR BRAND-NEW ACCOUNT                             */}
          {/* ================================================================= */}
          {onboardingActive ? (
            <div>
              {/* Progress Indicator */}
              <div className="mb-6 flex gap-2">
                {[1, 2, 3].map(stepNum => (
                  <i
                    key={stepNum}
                    className={`h-1.5 flex-1 rounded-full ${
                      stepNum <= onboardingStep ? 'bg-primary' : 'bg-highlight/50'
                    }`}
                  />
                ))}
              </div>

              {/* STEP 1: Profile details */}
              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1 of 3</p>
                  <h1 className="text-2xl font-black">Welcome! Let&apos;s set up your profile</h1>
                  <p className="text-sm text-muted">
                    We&apos;ll tailor your study roadmap and timeline to your academic year.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-muted">Your Name</label>
                      <input
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                        placeholder="e.g. Aarav Patel"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted">Degree / Course</label>
                      <input
                        value={course}
                        onChange={e => setCourse(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                        placeholder="e.g. Computer Science & Engineering"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted">Current Semester</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={semester}
                        onChange={e => setSemester(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setOnboardingStep(2)}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20"
                  >
                    Continue to First Subject <ArrowRight size={17} />
                  </button>
                </div>
              )}

              {/* STEP 2: Add First Subject */}
              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 2 of 3</p>
                  <h1 className="text-2xl font-black">Add your first subject</h1>
                  <p className="text-sm text-muted">
                    Start by registering the subject you are currently focusing on.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-muted">Subject Title</label>
                      <input
                        value={subjectName}
                        onChange={e => {
                          setSubjectName(e.target.value);
                          if (!subjectCode) {
                            setSubjectCode(e.target.value.substring(0, 4).toUpperCase());
                          }
                        }}
                        className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                        placeholder="e.g. Database Management Systems"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted">Subject Code</label>
                      <input
                        value={subjectCode}
                        onChange={e => setSubjectCode(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                        placeholder="e.g. CS-401 or DBMS"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted">Accent Color</label>
                      <div className="mt-1.5 flex gap-3">
                        {['#4B2DB8', '#7C3AED', '#D946EF', '#2563EB', '#059669', '#EA580C'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSubjectColor(c)}
                            className={`h-8 w-8 rounded-full transition ${
                              subjectColor === c ? 'ring-4 ring-primary/30 scale-110' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setOnboardingStep(1)}
                      className="w-1/3 rounded-xl border border-highlight px-4 py-3.5 text-sm font-bold text-muted"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!subjectName.trim() || submitting}
                      onClick={handleCreateFirstSubject}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="animate-spin" size={17} /> : 'Create Subject'} <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Syllabus Setup (Import PDF or Manual) */}
              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 3 of 3</p>
                  <h1 className="text-2xl font-black">Build your syllabus roadmap</h1>
                  <p className="text-sm text-muted">
                    Upload your course syllabus PDF to automatically extract units and topics, or add them manually.
                  </p>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-highlight/30 p-1">
                    <button
                      type="button"
                      onClick={() => setImportMode('import')}
                      className={`rounded-lg py-2 text-xs font-bold transition ${
                        importMode === 'import' ? 'bg-white text-primary shadow-sm' : 'text-muted'
                      }`}
                    >
                      Import Syllabus (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('manual')}
                      className={`rounded-lg py-2 text-xs font-bold transition ${
                        importMode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-muted'
                      }`}
                    >
                      Manual Entry
                    </button>
                  </div>

                  {/* Import Mode */}
                  {importMode === 'import' && (
                    <div className="space-y-3 pt-2">
                      <div className="border-2 border-dashed border-highlight rounded-2xl p-6 text-center bg-canvas">
                        <Upload className="mx-auto text-primary" size={28} />
                        <p className="mt-2 text-sm font-bold">
                          {uploadedFile ? uploadedFile.name : 'Choose a syllabus PDF'}
                        </p>
                        <p className="text-xs text-muted mt-1">Upload lecture plan or course handbook</p>
                        <input
                          type="file"
                          accept=".pdf"
                          id="syllabus-file-input"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              setUploadedFile(e.target.files[0]);
                            }
                          }}
                        />
                        <label
                          htmlFor="syllabus-file-input"
                          className="mt-4 inline-block cursor-pointer rounded-xl bg-white border border-highlight px-4 py-2 text-xs font-bold text-deep shadow-sm"
                        >
                          Select PDF Document
                        </label>
                      </div>

                      {processingSyllabus ? (
                        <div className="rounded-2xl bg-purple-50 p-4 text-center space-y-2">
                          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
                          <p className="text-sm font-bold text-deep">Processing syllabus...</p>
                          <p className="text-xs text-muted">{syllabusStatus}</p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleProcessSyllabus}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20"
                        >
                          Extract & Build Syllabus <Sparkles size={17} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Manual Mode */}
                  {importMode === 'manual' && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs font-bold text-muted">Unit Name</label>
                        <input
                          value={manualUnitTitle}
                          onChange={e => setManualUnitTitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 outline-primary text-sm"
                          placeholder="e.g. Unit 1: Relational Model"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted">Initial Topic</label>
                        <input
                          value={manualTopicTitle}
                          onChange={e => setManualTopicTitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 outline-primary text-sm"
                          placeholder="e.g. Entity-Relationship Diagrams"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddManualUnitAndTopic}
                        disabled={!manualUnitTitle.trim() || submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary text-primary px-4 py-2.5 text-xs font-bold hover:bg-purple-50 disabled:opacity-50"
                      >
                        <Plus size={15} /> Add Unit & Topic
                      </button>

                      {manualAddedList.length > 0 && (
                        <div className="mt-2 space-y-1 rounded-xl bg-canvas p-3 text-xs">
                          <p className="font-bold text-muted">Added units:</p>
                          {manualAddedList.map((m, idx) => (
                            <p key={idx} className="font-semibold text-deep">
                              • {m.unit} {m.topics.length > 0 ? `(${m.topics.join(', ')})` : ''}
                            </p>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20"
                      >
                        Finish & Open Workspace <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* STANDARD LOGIN / SIGNUP FORM                                     */
            /* =============================================================== */
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <p className="text-sm text-muted">
                  {isSignUp ? 'Create your LunaLearn account' : 'Welcome back to LunaLearn'}
                </p>
                <h1 className="mt-2 text-3xl font-black">
                  {isSignUp ? 'Get started' : 'Sign in'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isSignUp
                    ? 'Start turning your syllabus into personalized, calm academic guidance.'
                    : 'Log in to continue where you left off in your academic navigator.'}
                </p>
              </div>

              {authError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {authError}
                </div>
              )}

              <div className="space-y-3 pt-1">
                {isSignUp && (
                  <div>
                    <label className="text-xs font-bold text-muted">Full Name</label>
                    <input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                      placeholder="e.g. Aarav Patel"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-muted">Email Address</label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    type="email"
                    required
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted">Password</label>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type="password"
                    required
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-3 outline-primary text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-deep disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : isSignUp ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
                {!submitting && <ArrowRight size={17} />}
              </button>

              {process.env.NODE_ENV === 'development' && <p className="text-center text-xs text-muted">Demo mode: seed the local DBMS dataset, then sign in with your configured demo credentials.</p>}

              <p className="text-center text-xs text-muted pt-2">
                {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="font-bold text-primary hover:underline"
                >
                  {isSignUp ? 'Log in' : 'Sign up'}
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
