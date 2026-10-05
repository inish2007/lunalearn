'use client';
import { PdfPreview } from './PdfPreview';
import { ReadinessDetails } from './ReadinessDetails';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  FileText,
  Folder,
  FolderPlus,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wand2,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import { TopicUpdateConflictError, useAcademic } from '@/lib/context/AcademicContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { api, ClientAppError } from '@/lib/api';
import { AcademicDataErrorBanner, AcademicDataSkeleton, Card, PageHeader, Progress, Risk, TaskRow } from './Ui';
import type { Subject, Task, Exam, Material, GenerateQuizResponseData, SubmitQuizResponseData, AssistantChatMessage } from '@/lib/types/academic';

type View =
  | 'learning'
  | 'materials'
  | 'assistant'
  | 'tasks'
  | 'planner'
  | 'exams'
  | 'quizzes'
  | 'analytics'
  | 'simulator'
  | 'profile'
  | 'notifications'
  | 'settings';

const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-deep disabled:opacity-50';

export function Workspace({ view }: { view: View }) {
  const { asyncState, refreshAll } = useAcademic();
  const content: Record<View, React.ReactNode> = {
    learning: <Learning />,
    materials: <Materials />,
    assistant: <Assistant />,
    tasks: <Tasks />,
    planner: <Planner />,
    exams: <Exams />,
    quizzes: <Quizzes />,
    analytics: <Analytics />,
    simulator: <Simulator />,
    profile: <Profile />,
    notifications: <Notifications />,
    settings: <Settings />
  };

  if (asyncState.status === 'idle' || asyncState.status === 'loading' || asyncState.status === 'retrying') {
    return <div className="page-fade"><AcademicDataSkeleton label="Loading workspace" /></div>;
  }

  if (asyncState.status === 'error') {
    return (
      <div className="page-fade">
        <AcademicDataErrorBanner
          message={asyncState.error?.userMessage || asyncState.error?.message || 'Your academic records could not be synchronized.'}
          actionSuggestion={asyncState.error?.actionSuggestion}
          onRetry={() => { void refreshAll(); }}
        />
      </div>
    );
  }

  return <div className="page-fade">{content[view]}</div>;
}

// ============================================================================
// 1. MY LEARNING (/learning)
// ============================================================================
function Learning() {
  const {
    subjects,
    units,
    topics,
    readinessMap,
    createSubject,
    deleteSubject,
    createUnit,
    deleteUnit,
    createTopic,
    updateTopic,
    deleteTopic,
    loadUnitsAndTopics
  } = useAcademic();

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subColor, setSubColor] = useState('#4B2DB8');

  // Selected subject for unit & topic drill-down
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const activeSubjectId = selectedSubId || subjects[0]?.id || null;
  const activeSubject = subjects.find(s => s.id === activeSubjectId);

  // Add unit modal
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitTitle, setUnitTitle] = useState('');

  // Add topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [targetUnitId, setTargetUnitId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicConflict, setTopicConflict] = useState<TopicUpdateConflictError | null>(null);
  const [resolvingTopicConflict, setResolvingTopicConflict] = useState(false);

  const handleTopicUpdate = async (id: string, patch: Parameters<typeof updateTopic>[1], subjectId: string) => {
    try {
      await updateTopic(id, patch, subjectId);
    } catch (err) {
      if (err instanceof TopicUpdateConflictError) setTopicConflict(err);
      else console.error('Failed to update topic:', err);
    }
  };

  const resolveTopicConflict = async (choice: 'reload' | 'keep') => {
    if (!topicConflict) return;
    setResolvingTopicConflict(true);
    try {
      if (choice === 'reload') {
        if (topicConflict.subjectId) await loadUnitsAndTopics(topicConflict.subjectId);
      } else if (topicConflict.latestTopic?.updated_at) {
        await updateTopic(
          topicConflict.topicId,
          topicConflict.patch,
          topicConflict.subjectId,
          topicConflict.latestTopic.updated_at
        );
      }
      setTopicConflict(null);
    } catch (err) {
      if (err instanceof TopicUpdateConflictError) setTopicConflict(err);
      else console.error('Failed to resolve topic update conflict:', err);
    } finally {
      setResolvingTopicConflict(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim()) return;
    try {
      const created = await createSubject({
        name: subName.trim(),
        code: subCode.trim() || subName.substring(0, 4).toUpperCase(),
        color: subColor
      });
      if (created?.id) setSelectedSubId(created.id);
      setSubName('');
      setSubCode('');
      setShowSubjectModal(false);
    } catch (err) {
      console.error('Failed to create subject:', err);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectId || !unitTitle.trim()) return;
    const existingCount = (units[activeSubjectId] || []).length;
    await createUnit({
      subject_id: activeSubjectId,
      unit_number: existingCount + 1,
      title: unitTitle.trim()
    });
    setUnitTitle('');
    setShowUnitModal(false);
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUnitId || !topicTitle.trim()) return;
    await createTopic(
      {
        unit_id: targetUnitId,
        title: topicTitle.trim(),
        status: 'not_started',
        is_weak: false,
        mastery_score: 0
      },
      activeSubjectId || undefined
    );
    setTopicTitle('');
    setShowTopicModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Syllabus navigator"
        title="My learning"
        description="Track every subject from units to topics, and keep the weak areas in view."
        action={
          <button onClick={() => setShowSubjectModal(true)} className={primaryButtonClass}>
            <Plus size={17} /> Add subject
          </button>
        }
      />

      {subjects.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">No subjects yet</h2>
          <p className="mt-2 text-sm text-muted">
            Add your first course to begin mapping units, tracking topic mastery, and computing readiness.
          </p>
          <button
            onClick={() => setShowSubjectModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20"
          >
            <Plus size={16} /> Add Subject
          </button>
        </Card>
      ) : (
        <>
          {/* Subject Cards Grid */}
          <div className="grid gap-5 lg:grid-cols-3">
            {subjects.map(s => {
              const r = readinessMap[s.id];
              const topicCompletion = r?.breakdown?.topic_completion || 0;
              const readinessScore = r?.readiness_percentage;
              const subjectUnits = units[s.id] || [];

              // Gather weak topics
              const weakTopics: string[] = [];
              for (const u of subjectUnits) {
                const uTopics = topics[u.id] || [];
                for (const t of uTopics) {
                  if (t.is_weak) weakTopics.push(t.title);
                }
              }

              const isSelected = s.id === activeSubjectId;

              return (
                <Card
                  key={s.id}
                  className={`float-in transition cursor-pointer relative ${
                    isSelected ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-white"
                      style={{ background: s.color || '#4B2DB8' }}
                    >
                      {s.code}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete subject "${s.name}"? This will remove related units and topics.`)) {
                          deleteSubject(s.id);
                        }
                      }}
                      title="Delete subject"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h2 className="mt-4 text-lg font-black truncate">{s.name}</h2>
                  <p className="mt-0.5 text-xs text-muted">{subjectUnits.length} syllabus units registered</p>

                  <div className="mt-5 flex items-end justify-between">
                    <div className="w-3/5">
                      <div className="mb-2 flex justify-between text-xs font-bold">
                        <span>Completion</span>
                        <span>{topicCompletion}%</span>
                      </div>
                      <Progress value={topicCompletion} />
                    </div>
                    {typeof readinessScore === 'number' && (
                      <span className="text-2xl font-black text-primary">{readinessScore}%</span>
                    )}
                  </div>

                  {weakTopics.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-purple-50 p-3">
                      <p className="text-xs font-bold text-primary">Needs attention</p>
                      <p className="mt-1 text-xs font-semibold text-deep truncate">
                        {weakTopics.slice(0, 3).join(' · ')}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedSubId(s.id)}
                    className="mt-4 flex w-full items-center justify-between rounded-xl border border-highlight px-3 py-2 text-xs font-bold text-deep hover:bg-highlight/30 transition"
                  >
                    <span>{isSelected ? 'Viewing syllabus' : 'Explore syllabus'}</span>
                    <ChevronRight size={15} />
                  </button>
                </Card>
              );
            })}
          </div>

          {/* Unit & Topic Drill-Down Section for Selected Subject */}
          {activeSubject && (
            <Card className="mt-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg">{activeSubject.name} · Unit progress</h2>
                  <p className="mt-0.5 text-xs text-muted">Manage units and topics. Changes update readiness live.</p>
                </div>
                <button
                  onClick={() => setShowUnitModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-purple-50 transition"
                >
                  <Plus size={15} /> Add Unit
                </button>
              </div>

              {(units[activeSubject.id] || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No units added yet for this subject. Click &ldquo;Add Unit&rdquo; to begin syllabus mapping.
                </div>
              ) : (
                <div className="space-y-4">
                  {(units[activeSubject.id] || []).map(u => {
                    const unitTopicList = topics[u.id] || [];
                    const completedCount = unitTopicList.filter(t => t.status === 'completed').length;

                    return (
                      <div key={u.id} className="rounded-2xl border border-highlight/40 bg-canvas p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">
                              Unit {u.unit_number}: {u.title}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {unitTopicList.length === 0
                                ? 'No topics added'
                                : `${completedCount} of ${unitTopicList.length} topics complete`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setTargetUnitId(u.id);
                                setShowTopicModal(true);
                              }}
                              className="rounded-lg bg-white border border-highlight px-2.5 py-1 text-xs font-bold text-deep hover:bg-purple-50"
                            >
                              + Topic
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete unit "${u.title}"?`)) deleteUnit(u.id, activeSubject.id);
                              }}
                              className="text-muted hover:text-red-600 p-1"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Topics List within Unit */}
                        {unitTopicList.length > 0 && (
                          <div className="mt-3 divide-y divide-highlight/20 border-t border-highlight/30 pt-2">
                            {unitTopicList.map(t => (
                              <div key={t.id} className="flex items-center justify-between py-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={t.status === 'completed'}
                                    onChange={e => {
                                      void handleTopicUpdate(
                                        t.id,
                                        {
                                          status: e.target.checked ? 'completed' : 'in_progress',
                                          is_weak: e.target.checked ? false : t.is_weak
                                        },
                                        activeSubject.id
                                      );
                                    }}
                                    className="accent-primary rounded cursor-pointer"
                                  />
                                  <span className={`font-semibold ${t.status === 'completed' ? 'text-muted line-through' : 'text-deep'}`}>
                                    {t.title}
                                  </span>
                                  {t.is_weak && (
                                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                      Weak
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => { void handleTopicUpdate(t.id, { is_weak: !t.is_weak }, activeSubject.id); }}
                                    className="text-[10px] font-bold text-muted hover:text-primary"
                                  >
                                    {t.is_weak ? 'Unmark weak' : 'Mark weak'}
                                  </button>
                                  <button
                                    onClick={() => deleteTopic(t.id, activeSubject.id)}
                                    className="text-muted hover:text-red-600"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Add Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Add Subject</h3>
            <p className="mt-1 text-xs text-muted">Register a syllabus course.</p>
            <form onSubmit={handleAddSubject} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Course Name</label>
                <input
                  value={subName}
                  onChange={e => {
                    setSubName(e.target.value);
                    if (!subCode) setSubCode(e.target.value.substring(0, 4).toUpperCase());
                  }}
                  required
                  placeholder="e.g. Operating Systems"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Code</label>
                <input
                  value={subCode}
                  onChange={e => setSubCode(e.target.value)}
                  placeholder="e.g. OS-302"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Add Syllabus Unit</h3>
            <form onSubmit={handleAddUnit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Unit Title</label>
                <input
                  value={unitTitle}
                  onChange={e => setUnitTitle(e.target.value)}
                  required
                  placeholder="e.g. Memory Management & Paging"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md">
                  Add Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Add Topic</h3>
            <form onSubmit={handleAddTopic} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Topic Title</label>
                <input
                  value={topicTitle}
                  onChange={e => setTopicTitle(e.target.value)}
                  required
                  placeholder="e.g. Page Replacement Algorithms"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md">
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {topicConflict && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="topic-conflict-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="topic-conflict-title" className="text-lg font-bold">This topic changed elsewhere</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Another edit was saved before yours. Reload the latest topic or explicitly keep your changes on top of that version.
            </p>
            {topicConflict.latestTopic && (
              <p className="mt-3 rounded-lg bg-canvas p-3 text-xs text-muted">
                Latest saved status: <strong>{topicConflict.latestTopic.status}</strong>
                {topicConflict.latestTopic.is_weak ? ' · Marked weak' : ''}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { void resolveTopicConflict('reload'); }}
                disabled={resolvingTopicConflict}
                className="rounded-lg border border-highlight px-3 py-2 text-sm font-bold text-muted disabled:opacity-50"
              >
                Reload latest
              </button>
              <button
                type="button"
                onClick={() => { void resolveTopicConflict('keep'); }}
                disabled={resolvingTopicConflict || !topicConflict.latestTopic?.updated_at}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Keep my changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 2. MATERIALS (/materials)
// ============================================================================
function Materials() {
  const [preview, setPreview] = useState<{id: string; name: string} | null>(null);
  const { materials, subjects, createMaterial, uploadMaterialPdf, deleteMaterial } = useAcademic();
  const [query, setQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [matName, setMatName] = useState('');
  const [matSubjectId, setMatSubjectId] = useState('');
  const [matType, setMatType] = useState('PDF');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTimedOut, setUploadTimedOut] = useState(false);

  const filtered = materials.filter(m => {
    const matchesQuery = m.name.toLowerCase().includes(query.toLowerCase());
    const matchesSubject = selectedSubjectFilter === 'all' || m.subject_id === selectedSubjectFilter;
    return matchesQuery && matchesSubject;
  });

  const submitUpload = async () => {
    if (!matSubjectId) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadTimedOut(false);
    try {
      if (selectedFile) {
        await uploadMaterialPdf(selectedFile, matSubjectId);
      } else if (matName.trim()) {
        await createMaterial({
          subject_id: matSubjectId,
          name: matName.trim(),
          storage_path: `materials/${matSubjectId}/${matName.trim().replace(/\s+/g, '_')}`,
          file_type: matType,
          size_bytes: 1024000
        });
      }
      setMatName('');
      setSelectedFile(null);
      setShowUploadModal(false);
    } catch (err) {
      const timedOut = err instanceof ClientAppError && err.code === 'REQUEST_TIMEOUT';
      setUploadTimedOut(timedOut);
      setUploadError(err instanceof ClientAppError ? err.userMessage : err instanceof Error ? err.message : 'Material upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitUpload();
  };

  return (
    <>
      <PageHeader
        eyebrow="Personal academic library"
        title="My materials"
        description="Keep notes, PDFs and slides organized by subject, then let LunaLearn use them to help you study."
        action={
          <button
            onClick={() => {
              if (subjects.length > 0 && !matSubjectId) setMatSubjectId(subjects[0].id);
              setShowUploadModal(true);
            }}
            className={primaryButtonClass}
          >
            <Upload size={17} /> Upload material
          </button>
        }
      />

      {materials.length === 0 ? (
        <Card className="py-12 text-center">
          <Upload className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">No study materials yet</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            No study materials yet, upload your syllabus or notes to make them available to LunaLearn AI.
          </p>
          <button
            onClick={() => {
              if (subjects.length > 0 && !matSubjectId) setMatSubjectId(subjects[0].id);
              setShowUploadModal(true);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md"
          >
            <Upload size={16} /> Upload Study Material
          </button>
        </Card>
      ) : (
        <div className="mb-5 grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit">
            <button
              onClick={() => {
                if (subjects.length > 0 && !matSubjectId) setMatSubjectId(subjects[0].id);
                setShowUploadModal(true);
              }}
              className="mb-4 flex w-full items-center gap-2 rounded-xl bg-highlight/45 p-3 text-sm font-bold text-deep hover:bg-highlight/60 transition"
            >
              <FolderPlus size={17} /> Add material
            </button>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedSubjectFilter('all')}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                  selectedSubjectFilter === 'all' ? 'bg-primary text-white font-bold' : 'text-muted hover:bg-highlight/30'
                }`}
              >
                <Folder size={16} /> All materials
              </button>
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectFilter(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm truncate ${
                    selectedSubjectFilter === s.id ? 'bg-primary text-white font-bold' : 'text-muted hover:bg-highlight/30'
                  }`}
                >
                  <Folder size={16} /> {s.name}
                </button>
              ))}
            </div>
          </Card>

          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 items-center gap-2 rounded-xl bg-white px-4 shadow-sm">
                <Search size={18} className="text-muted" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                  placeholder="Search your notes, PDFs and slides"
                />
              </label>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-highlight/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted">
                <span>Name</span>
                <span className="hidden sm:block">Subject</span>
                <span>Action</span>
              </div>

              <div className="divide-y divide-highlight/25">
                {filtered.map(m => {
                  const sub = subjects.find(s => s.id === m.subject_id);
                  return (
                    <div key={m.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-primary">
                          <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                          <button className="truncate text-sm font-bold text-primary hover:underline" onClick={() => setPreview(m)}>{m.name}</button>
                          <p className="text-xs text-muted">{m.file_type || 'PDF'}</p>
                        </div>
                      </div>
                      <span className="hidden text-xs font-semibold text-muted sm:block">{sub?.code || 'Course'}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete material "${m.name}"?`)) deleteMaterial(m.id);
                        }}
                        className="text-muted hover:text-red-600 p-1"
                        title="Delete material"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {preview && <PdfPreview material={preview} onClose={() => setPreview(null)} />}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Upload Study Material</h3>
            <p className="text-xs text-muted mt-1">Upload a PDF lecture note or syllabus to index with LunaLearn AI.</p>
            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Select PDF Document</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!matName) setMatName(file.name);
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Document Title</label>
                <input
                  value={matName}
                  onChange={e => setMatName(e.target.value)}
                  required
                  placeholder="e.g. Unit 3 Normalization Notes.pdf"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Subject</label>
                <select
                  value={matSubjectId}
                  onChange={e => setMatSubjectId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              {uploadError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p>{uploadError}</p>
                  {uploadTimedOut && (
                    <button
                      type="button"
                      onClick={() => { void submitUpload(); }}
                      disabled={isUploading}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold disabled:opacity-50"
                    >
                      <RefreshCw size={14} /> Retry upload
                    </button>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isUploading ? 'Uploading & Indexing...' : 'Upload & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 3. AI ASSISTANT (/assistant)
// ============================================================================
function Assistant() {
  const { subjects, materials } = useAcademic();
  const [selectedSubId, setSelectedSubId] = useState<string>(subjects[0]?.id || '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string; isFallback?: boolean; notice?: string }[]>([
    {
      role: 'ai',
      text: 'Hello! I am your LunaLearn study assistant. Ask me questions about your course materials, explanations of difficult topics, or what to revise today.'
    }
  ]);
  const [timeoutRetry, setTimeoutRetry] = useState<{ prompt: string; message: string } | null>(null);

  const activeSub = subjects.find(s => s.id === selectedSubId) || subjects[0];
  const activeMaterials = materials.filter(m => !selectedSubId || m.subject_id === selectedSubId);

  const send = async (retryPrompt?: string) => {
    const isRetry = typeof retryPrompt === 'string';
    const userPrompt = isRetry ? retryPrompt : text.trim();
    if (!userPrompt || sending) return;
    setText('');
    setSending(true);
    setTimeoutRetry(null);
    if (!isRetry) setMessages(prev => [...prev, { role: 'user', text: userPrompt }]);

    try {
      const priorMessages = messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .slice(isRetry ? 0 : undefined, isRetry ? -1 : undefined);
      const history: AssistantChatMessage[] = priorMessages
        .map(m => ({ role: m.role === 'ai' ? ('assistant' as const) : ('user' as const), content: m.text }))
        .slice(-10);

      const res = await api.assistant.chat({
        message: userPrompt,
        subject_id: activeSub?.id || null,
        material_id: null,
        conversation_history: history
      });

      setMessages(prev => [...prev, {
        role: 'ai',
        text: res.answer || 'No answer returned.',
        isFallback: res.is_fallback,
        notice: res.notice
      }]);
    } catch (err: unknown) {
      if (err instanceof ClientAppError && err.code === 'REQUEST_TIMEOUT') {
        setTimeoutRetry({ prompt: userPrompt, message: err.userMessage });
      } else {
        const msg = err instanceof ClientAppError ? err.userMessage : err instanceof Error ? err.message : 'Assistant request failed. Please try again.';
        setMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${msg}` }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Grounded in your learning"
        title="AI Study Assistant"
        description="Ask about a subject, uploaded materials, a mistake, or what to study next."
      />

      {subjects.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">No subjects yet</h2>
          <p className="mt-2 text-sm text-muted">
            Add a course in My Learning to enable personalized AI study assistance.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <Card className="flex min-h-[570px] flex-col p-0">
            <div className="flex items-center justify-between border-b border-highlight/35 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
                  <Bot size={19} />
                </span>
                <div>
                  <p className="text-sm font-bold">Study with Luna</p>
                  <p className="text-xs text-muted">{activeSub?.name || 'Academic context'}</p>
                </div>
              </div>

              <select
                value={selectedSubId}
                onChange={e => setSelectedSubId(e.target.value)}
                className="rounded-lg bg-highlight/40 px-3 py-1.5 text-xs font-bold text-deep outline-none"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-4 p-5 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    m.role === 'ai' ? 'bg-purple-50 text-ink' : 'ml-auto bg-primary text-white'
                  }`}
                >
                  {m.text}
                  {m.isFallback && (
                    <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                      {m.notice || 'The AI model was temporarily unavailable; this answer was generated without it.'}
                    </p>
                  )}
                </div>
              ))}
              {timeoutRetry && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p>{timeoutRetry.message}</p>
                  <button
                    type="button"
                    onClick={() => { void send(timeoutRetry.prompt); }}
                    disabled={sending}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> Retry question
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-highlight/35 p-4">
              <div className="flex items-center gap-2 rounded-2xl bg-canvas p-2 pl-4">
                <input
                  onKeyDown={e => e.key === 'Enter' && send()}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder={`Ask Luna about ${activeSub?.name || 'your studies'}...`}
                />
                <button onClick={() => { void send(); }} disabled={sending} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white disabled:opacity-50">
                  <Send size={17} />
                </button>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <h2 className="font-bold text-sm">Suggested prompts</h2>
              <div className="mt-3 space-y-2">
                {[
                  `Summarize the key concepts for ${activeSub?.code || 'this course'}`,
                  'What weak topics should I revise today?',
                  'Give me a 5-question check-in quiz',
                  'Explain the most challenging module simply'
                ].map(p => (
                  <button
                    key={p}
                    onClick={() => setText(p)}
                    className="w-full rounded-xl bg-highlight/30 p-2.5 text-left text-xs font-semibold text-deep hover:bg-highlight/50 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="font-bold text-sm">Indexed materials</h2>
              {activeMaterials.length === 0 ? (
                <p className="mt-2 text-xs text-muted">No materials uploaded yet for this subject.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {activeMaterials.slice(0, 3).map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <FileText size={14} className="text-primary shrink-0" />
                      <span className="truncate font-semibold">{m.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 4. TASKS (/tasks)
// ============================================================================
function Tasks() {
  const { tasks, subjects, createTask, toggleTask, deleteTask, risks } = useAcademic();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('High');
  const [type, setType] = useState('Assignment');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.is_completed).length;
  const deadlineRisk = risks.find(r => r.type === 'DEADLINE_RISK' || r.type === 'WORKLOAD_RISK');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      subject_id: subjectId || null,
      type,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null
    });
    setTitle('');
    setShowTaskModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Academic commitments"
        title="Tasks & assignments"
        description="See what needs your attention, without losing the bigger study picture."
        action={
          <button
            onClick={() => {
              if (subjects.length > 0 && !subjectId) setSubjectId(subjects[0].id);
              setShowTaskModal(true);
            }}
            className={primaryButtonClass}
          >
            <Plus size={17} /> Add task
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex gap-2">
            {(['all', 'pending', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                  filter === tab ? 'bg-primary text-white' : 'bg-highlight/35 text-deep'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-muted">
              You&apos;re all caught up, no tasks have been created yet
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">No {filter} tasks.</div>
          ) : (
            <div className="divide-y divide-highlight/25">
              {filteredTasks.map(t => {
                const sub = subjects.find(s => s.id === t.subject_id);
                const dueText = t.due_date
                  ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'No deadline';

                return (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => toggleTask(t.id, t.is_completed)}
                        className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                          t.is_completed ? 'border-primary bg-primary text-white' : 'border-highlight bg-white'
                        }`}
                      >
                        {t.is_completed && <CheckCircle2 size={13} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${t.is_completed ? 'line-through text-muted' : 'text-ink'}`}>
                          {t.title}
                        </p>
                        <p className="text-xs text-muted">
                          {t.type} · {sub?.code || 'General'} · Due {dueText}
                          {t.priority === 'High' && ' · High priority'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="text-muted hover:text-red-600 p-1 ml-2"
                      title="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          {deadlineRisk ? (
            <Risk
              label={deadlineRisk.type === 'WORKLOAD_RISK' ? 'Workload conflict' : 'Deadline risk'}
              detail={deadlineRisk.reason}
            />
          ) : (
            <Risk label="Deadlines on track" detail="No urgent deadline risks detected." />
          )}

          <Card>
            <h2 className="font-bold">Summary</h2>
            <p className="mt-1 text-sm text-muted">{pendingCount} tasks remaining</p>
            {tasks.length > 0 && (
              <div className="mt-4">
                <Progress value={Math.round(((tasks.length - pendingCount) / tasks.length) * 100)} />
                <p className="mt-2 text-xs font-semibold text-primary">
                  {Math.round(((tasks.length - pendingCount) / tasks.length) * 100)}% complete
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showTaskModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Add Task</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Complete schema normalization set"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Course (Optional)</label>
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                >
                  <option value="">General (No subject)</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted">Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Task">Task</option>
                    <option value="Revision">Revision</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 5. PLANNER (/planner)
// ============================================================================
function Planner() {
  const { plannerContext, subjects, exams, tasks, risks } = useAcademic();
  const [constraintConflict, setConstraintConflict] = useState<ClientAppError | null>(null);

  const settings = plannerContext?.student?.study_time_settings;
  const now = new Date();

  useEffect(() => {
    if (subjects.length === 0 || !plannerContext) {
      setConstraintConflict(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setConstraintConflict(null);

    api.planner.getContext(undefined, controller.signal, true).catch((err: unknown) => {
      if (!active || (err instanceof Error && err.name === 'AbortError')) return;
      if (err instanceof ClientAppError && err.code === 'CONSTRAINT_CONFLICT') {
        setConstraintConflict(err);
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [plannerContext?.generated_at, subjects.length]);

  return (
    <>
      <PageHeader
        eyebrow="Adaptive daily plan"
        title="Your study planner"
        description="Built around your exams, deadlines, weak areas, available time and recent performance."
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold">Your focused timeline</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Preferred focus window: {settings?.preferred_focus_time || 'Evening'}
                </p>
              </div>
              <span className="rounded-xl bg-purple-50 px-3 py-1 text-xs font-bold text-primary">
                {settings?.available_hours_per_day || 2.0}h daily goal
              </span>
            </div>

            {constraintConflict ? (
              <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <h3 className="font-bold">This schedule isn&apos;t achievable with your available time</h3>
                <p className="mt-2 leading-6">{constraintConflict.userMessage || constraintConflict.message}</p>
                <p className="mt-2 text-xs leading-5">
                  Move the exam date, revise the weak or unfinished topics, or increase your available study hours per day.
                </p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                Add courses and exams to generate a tailored timeline.
              </div>
            ) : (
              <div className="space-y-3">
                {subjects.slice(0, 3).map((s, idx) => {
                  const subTasks = tasks.filter(t => t.subject_id === s.id && !t.is_completed);
                  return (
                    <div key={s.id} className="flex gap-4 items-center">
                      <span className="w-16 text-xs font-bold text-muted">Slot {idx + 1}</span>
                      <div className="flex-1 rounded-2xl bg-canvas border border-highlight/40 p-4">
                        <p className="text-sm font-bold">{s.name}</p>
                        <p className="text-xs text-muted mt-1">
                          {subTasks.length > 0
                            ? `Focus on: ${subTasks[0].title}`
                            : 'Review core topics and log practice'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="font-bold">Why this plan?</h2>
            {risks.length > 0 ? (
              <div className="mt-4 space-y-3">
                {risks.map((r, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-highlight/45 text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted leading-relaxed">{r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Your study timeline dynamically adapts to your pending assignments and upcoming exams.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// 6. EXAMS & READINESS (/exams)
// ============================================================================
function Exams() {
  const { exams, subjects, readinessMap, createExam, deleteExam, risks } = useAcademic();
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examSubId, setExamSubId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [targetScore, setTargetScore] = useState(85);

  const now = new Date();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examSubId || !examDate) return;
    await createExam({
      subject_id: examSubId,
      title: examTitle.trim(),
      exam_date: new Date(examDate).toISOString(),
      target_score: Number(targetScore)
    });
    setExamTitle('');
    setShowExamModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Performance intelligence"
        title="Exams & readiness"
        description="Readiness reflects your topic completion, quiz performance, revision activity and assignment progress."
        action={
          <button
            onClick={() => {
              if (subjects.length > 0 && !examSubId) setExamSubId(subjects[0].id);
              setShowExamModal(true);
            }}
            className={primaryButtonClass}
          >
            <Plus size={17} /> Schedule exam
          </button>
        }
      />

      {exams.length === 0 ? (
        <Card className="py-12 text-center">
          <Calendar className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">No exams added</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Schedule your upcoming mid-semester or final exams to activate mathematical readiness calculations and risk monitoring.
          </p>
          <button
            onClick={() => {
              if (subjects.length > 0 && !examSubId) setExamSubId(subjects[0].id);
              setShowExamModal(true);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md"
          >
            <Plus size={16} /> Schedule Exam
          </button>
        </Card>
      ) : (
        <div className="space-y-5">
          {exams.map(e => {
            const sub = subjects.find(s => s.id === e.subject_id);
            const r = readinessMap[e.subject_id];
            const diffMs = new Date(e.exam_date).getTime() - now.getTime();
            const daysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const hasScore = r && typeof r.readiness_percentage === 'number';

            return (
              <Card key={e.id} className="overflow-hidden">
                <div className="grid gap-6 lg:grid-cols-[150px_1fr_280px]">
                  {/* Readiness Circular Ring */}
                  <div className="grid h-36 w-36 place-items-center rounded-full border-[13px] border-highlight text-center">
                    {hasScore ? (
                      <>
                        <strong className="text-3xl text-deep">{r.readiness_percentage}%</strong>
                        <span className="text-xs text-muted">ready</span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-muted p-2">Building...</span>
                    )}
                  </div>

                  {/* Exam Info */}
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        {daysAway >= 0 ? `${daysAway} days remaining` : 'Exam completed'} ·{' '}
                        {new Date(e.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <button
                        onClick={() => {
                          if (confirm(`Delete exam "${e.title}"?`)) deleteExam(e.id);
                        }}
                        className="text-muted hover:text-red-600 p-1"
                        title="Delete exam"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h2 className="mt-1 text-2xl font-black">{e.title}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {sub?.name || 'Subject'} · Target Score: {e.target_score}%
                    </p>
                  </div>

                  <ReadinessDetails readiness={r} />
                  {/* Readiness Drivers (Exact breakdown) */}
                  <div className="rounded-2xl bg-canvas p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Readiness drivers</p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div>
                        <div className="mb-1 flex justify-between font-semibold">
                          <span>Topic Completion (40%)</span>
                          <span>{r?.breakdown?.topic_completion || 0}%</span>
                        </div>
                        <Progress value={r?.breakdown?.topic_completion || 0} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between font-semibold">
                          <span>Quiz Performance (30%)</span>
                          <span>{r?.breakdown?.quiz_performance || 0}%</span>
                        </div>
                        <Progress value={r?.breakdown?.quiz_performance || 0} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between font-semibold">
                          <span>Revision Activity (20%)</span>
                          <span>{r?.breakdown?.revision_activity || 0}%</span>
                        </div>
                        <Progress value={r?.breakdown?.revision_activity || 0} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between font-semibold">
                          <span>Assignments (10%)</span>
                          <span>{r?.breakdown?.assignment_completion || 0}%</span>
                        </div>
                        <Progress value={r?.breakdown?.assignment_completion || 0} />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showExamModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Schedule Exam</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Exam Title</label>
                <input
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                  required
                  placeholder="e.g. DBMS Mid-semester"
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Subject</label>
                <select
                  value={examSubId}
                  onChange={e => setExamSubId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Exam Date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Target Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={targetScore}
                  onChange={e => setTargetScore(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-highlight bg-canvas px-4 py-2.5 text-sm outline-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="rounded-xl border border-highlight px-4 py-2 text-sm font-bold text-muted"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-md">
                  Schedule Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 7. QUIZZES (/quizzes)
// ============================================================================
function Quizzes() {
  const { plannerContext, subjects, refreshAll } = useAcademic();
  const [selectedSubId, setSelectedSubId] = useState<string>(subjects[0]?.id || '');
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<GenerateQuizResponseData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponseData | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizTimedOut, setQuizTimedOut] = useState(false);

  // Extract recent quizzes from plannerContext
  const allRecentQuizzes = (plannerContext?.subjects || []).flatMap(s => s.recent_quiz_performance);

  const beginQuiz = async () => {
    if (!selectedSubId || generating) return;
    setGenerating(true);
    setQuizError(null);
    setQuizTimedOut(false);
    setResult(null);
    setAnswers({});
    try {
      const q = await api.quiz.generate({
        subject_id: selectedSubId,
        question_type: 'multiple_choice',
        num_questions: 5
      });
      setQuiz(q);
    } catch (err: unknown) {
      setQuiz(null);
      const timedOut = err instanceof ClientAppError && err.code === 'REQUEST_TIMEOUT';
      setQuizTimedOut(timedOut);
      setQuizError(err instanceof ClientAppError ? err.userMessage : err instanceof Error ? err.message : 'Failed to generate quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setQuizError(null);
    try {
      const payloadAnswers = quiz.questions.map(q => ({
        question_id: q.id,
        question: q.question,
        selected_answer: answers[q.id] || '',
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        topic_id: q.topic_id ?? null,
        topic_title: q.topic_title
      }));
      const res = await api.quiz.submit({ subject_id: quiz.subject_id, answers: payloadAnswers });
      setResult(res);
      await refreshAll();
    } catch (err: unknown) {
      setQuizError(err instanceof Error ? err.message : 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setQuizError(null);
    setQuizTimedOut(false);
  };

  const quizErrorNotice = quizError ? (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
      <p>{quizError}</p>
      {quizTimedOut && (
        <button
          type="button"
          onClick={() => { void beginQuiz(); }}
          disabled={generating}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold disabled:opacity-50"
        >
          <RefreshCw size={14} /> Retry quiz generation
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        eyebrow="Practice with feedback"
        title="Quizzes & exam simulator"
        description="Use short adaptive quizzes to turn weak topics into confident recall."
      />

      {allRecentQuizzes.length === 0 && !quiz && !result ? (
        <Card className="py-12 text-center">
          <CircleHelp className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">No quizzes yet</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            No quizzes yet, complete some topics or upload material to generate your first quiz.
          </p>
          {quizErrorNotice}
          {subjects.length > 0 && (
            <>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <span className="shrink-0">Subject</span>
                <select
                  value={selectedSubId}
                  onChange={e => setSelectedSubId(e.target.value)}
                  className="rounded-lg border border-highlight bg-canvas px-3 py-1.5 text-xs font-bold outline-primary"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={beginQuiz}
                disabled={generating}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                <Play size={16} /> {generating ? 'Generating...' : 'Begin Practice Quiz'}
              </button>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card className="min-h-[350px]">
            {result ? (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Quiz result</p>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black">{result.score}%</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${result.passed ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {result.correct_answers}/{result.total_questions} correct · {result.passed ? 'Passed' : 'Keep practicing'}
                  </span>
                </div>
                {result.weak_topics_identified.length > 0 && (
                  <div className="rounded-2xl bg-purple-50 p-3 text-xs">
                    <p className="font-bold text-primary">Weak areas to revise:</p>
                    <p className="mt-1 font-semibold">{result.weak_topics_identified.join(', ')}</p>
                  </div>
                )}
                <div className="divide-y divide-highlight/25">
                  {result.question_evaluations.map((ev, i) => (
                    <div key={i} className="py-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold truncate">{ev.question || `Question ${i + 1}`}</span>
                        <span className={`shrink-0 font-bold ${ev.is_correct ? 'text-green-700' : 'text-red-600'}`}>
                          {ev.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      {!ev.is_correct && ev.explanation && (
                        <p className="mt-1 text-muted">{ev.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={resetQuiz} className={`${primaryButtonClass} mt-2`}>
                  <Play size={16} /> Start another quiz
                </button>
              </div>
            ) : quiz ? (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {quiz.grounded ? 'Grounded diagnostic' : 'Diagnostic'} · {quiz.subject_name}
                </p>
                {quiz.is_fallback && (
                  <div role="status" className="flex gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-200">
                    <CircleAlert size={17} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Offline Resilience Mode:</span> {quiz.notice || 'Generated from syllabus structure due to external AI rate limiting.'}
                    </div>
                  </div>
                )}
                {quiz.questions.map((q, qi) => (
                  <div key={q.id} className="rounded-2xl border border-highlight/40 p-3.5">
                    <p className="flex gap-2 text-sm font-semibold">
                      <span className="text-muted shrink-0">{qi + 1}.</span>
                      <span>{q.question}</span>
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {q.options && q.options.length > 0 ? (
                        q.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            className={`flex w-full items-center rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                              answers[q.id] === opt
                                ? 'border-primary bg-purple-50 text-deep'
                                : 'border-highlight text-muted hover:border-primary hover:bg-purple-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))
                      ) : (
                        <input
                          value={answers[q.id] || ''}
                          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Type your answer..."
                          className="w-full rounded-lg border border-highlight bg-canvas px-3 py-2 text-xs outline-primary"
                        />
                      )}
                    </div>
                    {q.topic_title && (
                      <p className="mt-1.5 text-[10px] font-semibold text-primary">Topic: {q.topic_title}</p>
                    )}
                  </div>
                ))}
                {quizErrorNotice}
                <button
                  onClick={submitQuiz}
                  disabled={submitting}
                  className={`${primaryButtonClass} mt-1`}
                >
                  {submitting ? 'Scoring...' : 'Submit answers'} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center py-6">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-highlight/45 text-primary">
                    <CircleHelp size={28} />
                  </span>
                  <h2 className="mt-4 text-xl font-black">Practice Session</h2>
                  <p className="mt-2 text-sm text-muted max-w-xs mx-auto">
                    Take a 5-question adaptive quiz to identify weak areas and reinforce your retention.
                  </p>
                  {quizErrorNotice}
                  {subjects.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                      <span className="shrink-0">Subject</span>
                      <select
                        value={selectedSubId}
                        onChange={e => setSelectedSubId(e.target.value)}
                        className="rounded-lg border border-highlight bg-canvas px-3 py-1.5 text-xs font-bold outline-primary"
                      >
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button onClick={beginQuiz} disabled={generating} className={`${primaryButtonClass} mt-5`}>
                    <Play size={16} /> {generating ? 'Generating...' : 'Begin quiz'}
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-bold">Recent quiz activity</h2>
            {allRecentQuizzes.length === 0 ? (
              <p className="mt-4 text-xs text-muted">No quiz attempts logged yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-highlight/25">
                {allRecentQuizzes.slice(0, 4).map(q => (
                  <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">{q.score}%</span>
                      <span className="text-xs text-muted">
                        {q.correct_answers}/{q.total_questions} correct
                      </span>
                    </div>
                    {q.weak_topics_identified.length > 0 && (
                      <p className="mt-1 text-xs text-primary font-semibold truncate">
                        Weak areas: {q.weak_topics_identified.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 8. ANALYTICS (/analytics)
// ============================================================================
function Analytics() {
  const { subjects, readinessList } = useAcademic();

  const totalReadiness =
    readinessList.length > 0
      ? Math.round(
          readinessList.reduce((acc, r) => acc + r.readiness_percentage, 0) / readinessList.length
        )
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Your learning story"
        title="Analytics"
        description="A practical view of momentum, mastery and the patterns shaping your readiness."
      />

      {subjects.length === 0 ? (
        <Card className="py-12 text-center">
          <BarChart3 className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">Analytics overview</h2>
          <p className="mt-2 text-sm text-muted">
            Not enough activity yet, your analytics will appear as you study.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Average Readiness</p>
              <p className="mt-2 text-3xl font-black text-deep">{totalReadiness}%</p>
              <p className="mt-1 text-xs text-muted">Calculated across {subjects.length} courses</p>
            </Card>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Active Courses</p>
              <p className="mt-2 text-3xl font-black text-deep">{subjects.length}</p>
              <p className="mt-1 text-xs text-muted">Syllabus units tracked live</p>
            </Card>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Readiness Status</p>
              <p className="mt-2 text-3xl font-black text-primary">
                {totalReadiness >= 70 ? 'On Track' : 'Needs Focus'}
              </p>
              <p className="mt-1 text-xs text-muted">Based on 4-factor academic engine</p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 9. SIMULATOR (/simulator)
// ============================================================================
function Simulator() {
  const { subjects, exams, readinessMap } = useAcademic();
  const [hours, setHours] = useState(2);

  return (
    <>
      <PageHeader
        eyebrow="Try a different plan"
        title="What-if simulator"
        description="Explore how today's study choices could affect your plan before you commit."
      />

      {exams.length === 0 ? (
        <Card className="py-12 text-center">
          <Wand2 className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">Simulator inactive</h2>
          <p className="mt-2 text-sm text-muted">
            Add an exam and an active study plan before running a scenario.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
          <Card>
            <h2 className="font-bold">I have time today</h2>
            <div className="mt-5 flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="6"
                value={hours}
                onChange={e => setHours(+e.target.value)}
                className="w-full accent-primary"
              />
              <span className="rounded-xl bg-highlight/45 px-3 py-2 font-black text-primary">{hours}h</span>
            </div>
            <p className="mt-4 text-xs text-muted">
              Allocating focused time directly improves your revision activity driver (20% of readiness).
            </p>
          </Card>

          <Card className="bg-gradient-to-br from-deep to-primary text-white">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70">
              <Wand2 size={15} /> Predicted impact
            </p>
            <h2 className="mt-3 text-2xl font-black">Scenario outcome</h2>
            <p className="mt-2 text-sm text-white/80 leading-relaxed">
              Completing a {hours}-hour focus session today will contribute directly to your 120-minute benchmark, raising your readiness driver.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 10. LEARNING PROFILE (/profile)
// ============================================================================
function Profile() {
  const { profile, subjects, readinessMap } = useAcademic();

  const studentName = profile?.full_name || 'Aarav Patel';
  const studentInitials = studentName
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
      <PageHeader
        eyebrow="Long-term learner view"
        title="Personal learning profile"
        description="A living record of how you learn best, what you've mastered and where support will help."
      />

      {subjects.length === 0 ? (
        <Card className="py-12 text-center">
          <UserRound className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">Profile overview</h2>
          <p className="mt-2 text-sm text-muted">
            Your learning profile is being built, keep studying and taking quizzes.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <Card className="text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary text-2xl font-black text-white">
              {studentInitials}
            </span>
            <h2 className="mt-4 text-xl font-black">{studentName}</h2>
            <p className="mt-1 text-sm text-muted">
              {profile?.course || 'Degree'} · Semester {profile?.semester || 1}
            </p>
            <div className="mt-6 rounded-2xl bg-purple-50 p-3 text-left">
              <p className="text-xs text-muted">Focus style</p>
              <p className="mt-1 text-sm font-bold text-deep">
                {profile?.preferred_focus_time || 'Evenings (5:30 PM - 8:30 PM)'}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-base">Course Readiness Profiles</h2>
            <div className="mt-4 space-y-4">
              {subjects.map(s => {
                const r = readinessMap[s.id];
                const score = r?.readiness_percentage || 0;
                return (
                  <div key={s.id}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">{s.name}</span>
                      <strong className="text-primary">{score}%</strong>
                    </div>
                    <Progress value={score} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 11. NOTIFICATIONS (/notifications)
// ============================================================================
function Notifications() {
  const { risks } = useAcademic();

  return (
    <>
      <PageHeader
        eyebrow="Stay in the loop"
        title="Notifications"
        description="Important changes to your study plan, deadlines and learning progress."
      />

      {risks.length === 0 ? (
        <Card className="py-12 text-center">
          <Bell className="mx-auto text-primary" size={32} />
          <h2 className="mt-4 text-xl font-bold">All clear</h2>
          <p className="mt-2 text-sm text-muted">
            You&apos;re all clear, no new academic alerts.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-highlight/25 p-0 overflow-hidden">
          {risks.map((r, i) => (
            <div key={i} className="flex gap-4 p-5 items-start">
              <CircleAlert
                className={`shrink-0 mt-0.5 ${r.severity === 'high' ? 'text-red-500' : 'text-primary'}`}
                size={20}
              />
              <div className="flex-1">
                <p className="text-sm font-bold">
                  {r.type === 'HIGH_EXAM_RISK'
                    ? 'Upcoming Exam Risk'
                    : r.type === 'DEADLINE_RISK'
                    ? 'Deadline Urgency'
                    : r.type === 'WORKLOAD_RISK'
                    ? 'Workload Conflict'
                    : 'Performance Drop Alert'}
                </p>
                <p className="mt-1 text-sm text-muted leading-relaxed">{r.reason}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

// ============================================================================
// 12. SETTINGS (/settings)
// ============================================================================
function Settings() {
  const { profile } = useAcademic();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader
        eyebrow="Personalize LunaLearn"
        title="Settings"
        description="Manage your preferences, study schedule, cozy themes and notification choices."
      />

      <div className="max-w-3xl space-y-4">
        {/* Appearance & Theme Settings */}
        <Card>
          <div>
            <h2 className="font-bold text-ink">Appearance & Study Atmosphere</h2>
            <p className="mt-0.5 text-xs text-muted">
              Choose your study ambiance. Dreamy Dark Mode is crafted for late-night focus with soft lunar violet, ambient breathing glows, and zero eye fatigue.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-highlight/30 hover:border-primary/40 text-muted hover:text-ink'
                }`}
              >
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-purple-950/40 text-accent">
                  <Moon size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold">Dreamy Dark</p>
                  <p className="text-[10px] text-muted">Midnight Lunar</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-highlight/30 hover:border-primary/40 text-muted hover:text-ink'
                }`}
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100/60 text-amber-500">
                  <Sun size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold">Daylight</p>
                  <p className="text-[10px] text-muted">Soft Lily</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-highlight/30 hover:border-primary/40 text-muted hover:text-ink'
                }`}
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-highlight/30 text-ink">
                  <Monitor size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold">System Sync</p>
                  <p className="text-[10px] text-muted">Follows OS clock</p>
                </div>
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Profile Details</h2>
              <p className="mt-0.5 text-xs text-muted">
                {profile?.full_name || 'Aarav Patel'} · {profile?.course || 'Computer Science'} · Semester{' '}
                {profile?.semester || 1}
              </p>
            </div>
            <ChevronRight className="text-primary" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Study Preferences</h2>
              <p className="mt-0.5 text-xs text-muted">
                Preferred Focus Window: {profile?.preferred_focus_time || 'Evening (5:30 PM - 8:30 PM)'}
              </p>
            </div>
            <ChevronRight className="text-primary" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Academic Engine Integration</h2>
              <p className="mt-0.5 text-xs text-muted">Connected to live backend at http://localhost:4000/api</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">Online</span>
          </div>
        </Card>
      </div>
    </>
  );
}
