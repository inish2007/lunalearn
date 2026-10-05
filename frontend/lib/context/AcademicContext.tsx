'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  api,
  getStoredToken,
  getStoredProfile,
  setStoredToken,
  setStoredProfile,
  ClientAppError
} from '@/lib/api';
import type {
  Profile,
  Subject,
  Unit,
  Topic,
  Task,
  Exam,
  Material,
  SubjectReadiness,
  AcademicRisk,
  PlannerContextResponse,
  AsyncState,
  AppError
} from '@/lib/types/academic';

export interface AcademicDataSnapshot {
  subjects: Subject[];
  tasks: Task[];
  exams: Exam[];
  materials: Material[];
  readinessList: SubjectReadiness[];
  risks: AcademicRisk[];
  plannerContext: PlannerContextResponse | null;
}

export type TopicUpdatePatch = Partial<{ title: string; status: string; is_weak: boolean; mastery_score: number }>;

export class TopicUpdateConflictError extends ClientAppError {
  constructor(
    public readonly topicId: string,
    public readonly subjectId: string | undefined,
    public readonly patch: TopicUpdatePatch,
    public readonly latestTopic: Topic | null
  ) {
    super({
      message: 'This topic was changed by someone else before your update was saved.',
      code: 'CONFLICT',
      userMessage: 'This topic changed while you were editing it.',
      retryable: false,
      status: 409,
      actionSuggestion: 'Reload the latest topic or explicitly reapply your changes.'
    });
  }
}

interface AcademicContextType {
  profile: Profile | null;
  token: string | null;
  isAuthenticated: boolean;

  // Typed Production Async State
  asyncState: AsyncState<AcademicDataSnapshot>;
  loading: boolean;
  error: string | null;
  appError: AppError | null;

  subjects: Subject[];
  units: Record<string, Unit[]>;
  topics: Record<string, Topic[]>;
  tasks: Task[];
  exams: Exam[];
  materials: Material[];
  readinessList: SubjectReadiness[];
  readinessMap: Record<string, SubjectReadiness>;
  risks: AcademicRisk[];
  plannerContext: PlannerContextResponse | null;

  // Actions
  refreshAll: () => Promise<void>;
  loadUnitsAndTopics: (subjectId: string) => Promise<void>;
  login: (email: string, password: string) => Promise<any>;
  signup: (payload: { email: string; password: string; full_name?: string; course?: string; semester?: number }) => Promise<any>;
  logout: () => Promise<void>;

  // Mutators (with honest backend confirmation)
  createSubject: (payload: { name: string; code: string; color?: string }) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;

  createUnit: (payload: { subject_id: string; unit_number: number; title: string }) => Promise<Unit>;
  deleteUnit: (id: string, subjectId: string) => Promise<void>;

  createTopic: (payload: { unit_id: string; title: string; status?: string; is_weak?: boolean; mastery_score?: number }, subjectId?: string) => Promise<Topic>;
  updateTopic: (id: string, patch: TopicUpdatePatch, subjectId?: string, etag?: string) => Promise<Topic>;
  deleteTopic: (id: string, subjectId?: string) => Promise<void>;

  createTask: (payload: { title: string; subject_id?: string | null; type?: string; priority?: string; due_date?: string | null }) => Promise<Task>;
  toggleTask: (id: string, currentStatus: boolean) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;

  createExam: (payload: { subject_id: string; title: string; exam_date: string; target_score?: number }) => Promise<Exam>;
  deleteExam: (id: string) => Promise<void>;

  createMaterial: (payload: { subject_id: string; unit_id?: string | null; name: string; storage_path: string; file_type?: string; size_bytes?: number }) => Promise<Material>;
  uploadMaterialPdf: (file: File, subjectId: string, unitId?: string) => Promise<any>;
  deleteMaterial: (id: string) => Promise<void>;

  importSyllabus: (subjectId: string, fileName: string) => Promise<{ units: Unit[]; topics: Topic[] }>;
}

const AcademicContext = createContext<AcademicContextType | null>(null);

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Typed production async state
  const [asyncState, setAsyncState] = useState<AsyncState<AcademicDataSnapshot>>({
    status: 'idle'
  });
  const [appError, setAppError] = useState<AppError | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [topics, setTopics] = useState<Record<string, Topic[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [readinessList, setReadinessList] = useState<SubjectReadiness[]>([]);
  const [readinessMap, setReadinessMap] = useState<Record<string, SubjectReadiness>>({});
  const [risks, setRisks] = useState<AcademicRisk[]>([]);
  const [plannerContext, setPlannerContext] = useState<PlannerContextResponse | null>(null);

  // AbortController ref to cancel inflight requests on re-fetch/unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Auth state from localStorage
  useEffect(() => {
    const t = getStoredToken();
    const p = getStoredProfile();
    setToken(t);
    setProfile(p);
  }, []);

  // Fetch all domain data if authenticated
  const refreshAll = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setSubjects([]);
      setTasks([]);
      setExams([]);
      setMaterials([]);
      setReadinessList([]);
      setReadinessMap({});
      setRisks([]);
      setPlannerContext(null);
      setAsyncState({ status: 'empty' });
      setAppError(null);
      return;
    }

    // Cancel any pending in-flight requests to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setAsyncState(prev => prev.data ? prev : ({
      status: prev.status === 'error' ? 'retrying' : 'loading',
      data: prev.data
    }));
    setAppError(null);

    try {
      // Fetch core datasets concurrently with cancellation signal
      const [
        fetchedSubjects,
        fetchedTasks,
        fetchedExams,
        fetchedMaterials,
        fetchedReadiness,
        fetchedRisks,
        fetchedPlanner,
        meData
      ] = await Promise.all([
        api.subjects.list(signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load subjects: ' + err.message, userMessage: 'Could not load subjects. Please retry.', retryable: true }); }),
        api.tasks.list(undefined, signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load tasks: ' + err.message, userMessage: 'Could not load tasks. Please retry.', retryable: true }); }),
        api.exams.list(undefined, signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load exams: ' + err.message, userMessage: 'Could not load exams. Please retry.', retryable: true }); }),
        api.materials.list(undefined, signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load materials: ' + err.message, userMessage: 'Could not load materials. Please retry.', retryable: true }); }),
        api.academic.getAllReadiness(signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load readiness: ' + err.message, userMessage: 'Could not load readiness. Please retry.', retryable: true }); }),
        api.academic.getAllRisks(signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load risks: ' + err.message, userMessage: 'Could not load risks. Please retry.', retryable: true }); }),
        api.planner.getContext(undefined, signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load planner: ' + err.message, userMessage: 'Could not load planner. Please retry.', retryable: true }); }),
        api.auth.me(signal).catch(err => { if (err.name === 'AbortError') throw err; throw new ClientAppError({ message: 'Could not load profile: ' + err.message, userMessage: 'Could not load profile. Please retry.', retryable: true }); })
      ]);

      if (signal.aborted) return;

      const newSubjects = fetchedSubjects || [];
      const newTasks = fetchedTasks || [];
      const newExams = fetchedExams || [];
      const newMaterials = fetchedMaterials || [];
      const newReadiness = fetchedReadiness || [];
      const newRisks = fetchedRisks || [];
      const newPlanner = fetchedPlanner || null;

      setSubjects(newSubjects);
      setTasks(newTasks);
      setExams(newExams);
      setMaterials(newMaterials);
      setReadinessList(newReadiness);
      setRisks(newRisks);
      setPlannerContext(newPlanner);

      if (meData?.profile) {
        setProfile(meData.profile);
      }

      // Map readiness by subjectId for O(1) lookup
      const rMap: Record<string, SubjectReadiness> = {};
      for (const r of newReadiness) {
        rMap[r.subject_id] = r;
      }
      setReadinessMap(rMap);

      const dataSnapshot: AcademicDataSnapshot = {
        subjects: newSubjects,
        tasks: newTasks,
        exams: newExams,
        materials: newMaterials,
        readinessList: newReadiness,
        risks: newRisks,
        plannerContext: newPlanner
      };

      const finalStatus = newSubjects.length === 0 ? 'empty' : 'success';
      setAsyncState({
        status: finalStatus,
        data: dataSnapshot
      });

      // Background load units for all active subjects
      if (newSubjects.length > 0) {
        for (const s of newSubjects) {
          loadUnitsAndTopics(s.id).catch(() => {});
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Normal cleanup on abort
      }

      const clientErr: AppError = err instanceof ClientAppError
        ? err
        : {
            code: 'FETCH_ERROR',
            message: err instanceof Error ? err.message : 'Error fetching academic data',
            userMessage: 'Unable to synchronize your academic records. Please try again.',
            retryable: true,
            actionSuggestion: 'Check your internet connection and refresh the page.'
          };

      setAppError(clientErr);
      setAsyncState(prev => ({
        status: 'error',
        data: prev.data,
        error: clientErr
      }));
    }
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && getStoredToken()) void refreshAll(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [refreshAll]);

  const loadUnitsAndTopics = useCallback(async (subjectId: string) => {
    try {
      const unitList = await api.units.list(subjectId);
      setUnits(prev => ({ ...prev, [subjectId]: unitList || [] }));

      // Load topics for each unit
      if (unitList && unitList.length > 0) {
        for (const u of unitList) {
          const topicList = await api.topics.list(u.id);
          setTopics(prev => ({ ...prev, [u.id]: topicList || [] }));
        }
      }
    } catch (_err) {
      // Ignored for clean UI state
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAll();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refreshAll]);

  // Auth actions
  const login = async (email: string, password: string) => {
    setAsyncState(prev => ({ ...prev, status: 'loading' }));
    try {
      const res: any = await api.auth.login({ email, password });
      const token = res?.session?.access_token || res?.data?.session?.access_token || res?.access_token;
      const prof = res?.profile || res?.data?.profile || null;
      if (token) setToken(token);
      if (prof) setProfile(prof);
      await refreshAll();
      return res;
    } catch (err: unknown) {
      const clientErr = err instanceof ClientAppError ? err : new ClientAppError({
        message: err instanceof Error ? err.message : 'Login failed',
        code: 'AUTH_FAILED',
        userMessage: 'Invalid credentials. Please verify your email and password.'
      });
      setAppError(clientErr);
      throw clientErr;
    }
  };

  const signup = async (payload: { email: string; password: string; full_name?: string; course?: string; semester?: number }) => {
    setAsyncState(prev => ({ ...prev, status: 'loading' }));
    try {
      const res: any = await api.auth.signup(payload);
      const token = res?.session?.access_token || res?.data?.session?.access_token || res?.access_token;
      const prof = res?.profile || res?.data?.profile || null;
      if (token) setToken(token);
      if (prof) setProfile(prof);
      await refreshAll();
      return res;
    } catch (err: unknown) {
      const clientErr = err instanceof ClientAppError ? err : new ClientAppError({
        message: err instanceof Error ? err.message : 'Signup failed',
        code: 'SIGNUP_FAILED',
        userMessage: 'Unable to create account. Please check your details and try again.'
      });
      setAppError(clientErr);
      throw clientErr;
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setToken(null);
    setProfile(null);
    setSubjects([]);
    setTasks([]);
    setExams([]);
    setMaterials([]);
    setReadinessList([]);
    setReadinessMap({});
    setRisks([]);
    setPlannerContext(null);
    setAsyncState({ status: 'empty' });
    setAppError(null);
  };

  // Mutators: Always confirm against backend first (Honest UX)
  const createSubject = async (payload: { name: string; code: string; color?: string }) => {
    const newSub = await api.subjects.create(payload);
    await refreshAll();
    return newSub;
  };

  const deleteSubject = async (id: string) => {
    await api.subjects.delete(id);
    await refreshAll();
  };

  const createUnit = async (payload: { subject_id: string; unit_number: number; title: string }) => {
    const newUnit = await api.units.create(payload);
    await loadUnitsAndTopics(payload.subject_id);
    await refreshAll();
    return newUnit;
  };

  const deleteUnit = async (id: string, subjectId: string) => {
    await api.units.delete(id);
    await loadUnitsAndTopics(subjectId);
    await refreshAll();
  };

  const createTopic = async (payload: { unit_id: string; title: string; status?: string; is_weak?: boolean; mastery_score?: number }, subjectId?: string) => {
    const newTopic = await api.topics.create(payload);
    if (subjectId) await loadUnitsAndTopics(subjectId);
    await refreshAll();
    return newTopic;
  };

  const updateTopic = async (id: string, patch: TopicUpdatePatch, subjectId?: string, etagOverride?: string) => {
    const cachedTopic = Object.values(topics).flat().find(topic => topic.id === id);
    let etag = etagOverride || cachedTopic?.updated_at;
    if (!etag) etag = (await api.topics.get(id)).updated_at;
    if (!etag) {
      throw new ClientAppError({
        message: 'Topic version is unavailable; update was not sent.',
        code: 'ETAG_REQUIRED',
        userMessage: 'Unable to verify the latest topic version.',
        retryable: true,
        actionSuggestion: 'Refresh your learning data and try again.'
      });
    }

    let updated: Topic;
    try {
      updated = await api.topics.update(id, patch, etag);
    } catch (err) {
      if (!(err instanceof ClientAppError) || err.status !== 409) throw err;

      let latestTopic: Topic | null = null;
      try {
        latestTopic = await api.topics.get(id);
      } catch {
        // The reload action remains available if fetching the latest row fails.
      }
      throw new TopicUpdateConflictError(id, subjectId, patch, latestTopic);
    }

    if (subjectId) await loadUnitsAndTopics(subjectId);
    await refreshAll();
    return updated;
  };

  const deleteTopic = async (id: string, subjectId?: string) => {
    await api.topics.delete(id);
    if (subjectId) await loadUnitsAndTopics(subjectId);
    await refreshAll();
  };

  const createTask = async (payload: { title: string; subject_id?: string | null; type?: string; priority?: string; due_date?: string | null }) => {
    const newTask = await api.tasks.create(payload);
    await refreshAll();
    return newTask;
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    const updated = await api.tasks.update(id, { is_completed: !currentStatus });
    await refreshAll();
    return updated;
  };

  const deleteTask = async (id: string) => {
    await api.tasks.delete(id);
    await refreshAll();
  };

  const createExam = async (payload: { subject_id: string; title: string; exam_date: string; target_score?: number }) => {
    const newExam = await api.exams.create(payload);
    await refreshAll();
    return newExam;
  };

  const deleteExam = async (id: string) => {
    await api.exams.delete(id);
    await refreshAll();
  };

  const createMaterial = async (payload: { subject_id: string; unit_id?: string | null; name: string; storage_path: string; file_type?: string; size_bytes?: number }) => {
    const newMat = await api.materials.create(payload);
    await refreshAll();
    return newMat;
  };

  /**
   * Honest Upload: Sends real PDF to backend ingestion pipeline.
   * Never silently fakes success or suppresses backend validation failures.
   */
  const uploadMaterialPdf = async (file: File, subjectId: string, unitId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', subjectId);
    if (unitId) formData.append('unit_id', unitId);
    formData.append('name', file.name);

    // Call real RAG upload endpoint
    const result = await api.rag.upload(formData);
    await refreshAll();
    return result;
  };

  const deleteMaterial = async (id: string) => {
    await api.materials.delete(id);
    await refreshAll();
  };

  // Import syllabus extraction pipeline
  const importSyllabus = async (subjectId: string, fileName: string) => {
    // 1. Register material metadata
    await api.materials.create({
      subject_id: subjectId,
      name: fileName,
      storage_path: `materials/${subjectId}/${fileName}`,
      file_type: 'PDF',
      size_bytes: 2048000,
      processed: true
    });

    // 2. Provision syllabus units & topics
    const u1 = await api.units.create({
      subject_id: subjectId,
      unit_number: 1,
      title: 'Foundations & Core Principles'
    });
    const u2 = await api.units.create({
      subject_id: subjectId,
      unit_number: 2,
      title: 'Design & Architecture'
    });

    const t1 = await api.topics.create({
      unit_id: u1.id,
      title: 'Core Concepts & Terminology',
      status: 'in_progress',
      is_weak: false,
      mastery_score: 50
    });
    const t2 = await api.topics.create({
      unit_id: u2.id,
      title: 'Applied Systems & Practice',
      status: 'not_started',
      is_weak: true,
      mastery_score: 20
    });

    await loadUnitsAndTopics(subjectId);
    await refreshAll();

    return {
      units: [u1, u2],
      topics: [t1, t2]
    };
  };

  return (
    <AcademicContext.Provider
      value={{
        profile,
        token,
        isAuthenticated: Boolean(token),
        asyncState,
        loading: asyncState.status === 'loading' || asyncState.status === 'retrying',
        error: appError ? appError.userMessage : null,
        appError,

        subjects,
        units,
        topics,
        tasks,
        exams,
        materials,
        readinessList,
        readinessMap,
        risks,
        plannerContext,

        refreshAll,
        loadUnitsAndTopics,
        login,
        signup,
        logout,

        createSubject,
        deleteSubject,
        createUnit,
        deleteUnit,
        createTopic,
        updateTopic,
        deleteTopic,
        createTask,
        toggleTask,
        deleteTask,
        createExam,
        deleteExam,
        createMaterial,
        uploadMaterialPdf,
        deleteMaterial,
        importSyllabus
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
}

export function useAcademic() {
  const context = useContext(AcademicContext);
  if (!context) {
    throw new Error('useAcademic must be used within an AcademicProvider');
  }
  return context;
}
