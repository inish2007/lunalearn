/**
 * LunaLearn Production API Client
 * Connects frontend to the live backend at http://localhost:4000/api
 * Features:
 * - Unified Error Taxonomy & AppError parsing
 * - Infinite 401 Auth Loop Prevention (single-refresh retry guard)
 * - AbortController signal support for race-condition cancellation
 * - Async RAG job polling (UPLOADED -> VALIDATING -> EXTRACTING -> CHUNKING -> EMBEDDING -> INDEXING -> READY/FAILED)
 * - Idempotency key support for quiz submissions
 */

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
  AssistantChatResponseData,
  AssistantChatMessage,
  GenerateQuizResponseData,
  SubmitQuizResponseData,
  AppError,
  ApiResponse
} from './types/academic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'lunalearn_auth_token';
const REFRESH_TOKEN_KEY = 'lunalearn_auth_refresh_token';
const PROFILE_KEY = 'lunalearn_auth_profile';
const AI_REQUEST_TIMEOUT_MS = 30_000;

const AI_REQUEST_PATHS = new Set([
  '/assistant/chat',
  '/quiz/generate',
  '/rag/search',
  '/rag/upload'
]);

export class ClientAppError extends Error implements AppError {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly requestId?: string;
  public readonly status: number;
  public readonly issues?: { field: string; message: string }[];
  public readonly actionSuggestion?: string;

  constructor(params: {
    message: string;
    code?: string;
    userMessage?: string;
    retryable?: boolean;
    requestId?: string;
    status?: number;
    issues?: { field: string; message: string }[];
    actionSuggestion?: string;
  }) {
    super(params.message);
    this.name = 'ClientAppError';
    this.code = params.code || 'UNKNOWN_ERROR';
    this.userMessage = params.userMessage || params.message;
    this.retryable = params.retryable ?? false;
    this.requestId = params.requestId;
    this.status = params.status || 500;
    this.issues = params.issues;
    this.actionSuggestion = params.actionSuggestion || getActionSuggestion(this.code, this.status);
  }
}

function getActionSuggestion(code: string, status: number): string {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'TOKEN_EXPIRED':
      return 'Your session has expired. Please log in again to renew your access.';
    case 'FORBIDDEN':
      return 'You do not have permission to access or modify this resource.';
    case 'NOT_FOUND':
      return 'The requested resource was not found or may have been deleted.';
    case 'CONFLICT':
      return 'This record was modified elsewhere. Please refresh the page and try again.';
    case 'PAYLOAD_TOO_LARGE':
      return 'The file exceeds the maximum 10MB limit. Please upload a smaller file.';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Only genuine PDF documents are supported. Please verify your file format.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment before trying again.';
    case 'AI_CIRCUIT_OPEN':
    case 'AI_PROVIDER_ERROR':
      return 'The AI service is temporarily experiencing high load. Please try again in a few moments.';
    case 'VALIDATION_ERROR':
      return 'Please verify the fields you entered and try again.';
    case 'NO_RELEVANT_CONTEXT':
      return 'No relevant sections were found in your notes. Try asking a different concept or upload more materials.';
    default:
      if (status === 429) return 'Please wait a few seconds and retry.';
      if (status >= 500) return 'Server error. If this persists, please contact support.';
      return 'Please verify your inputs and retry.';
  }
}

// ----------------------------------------------------------------------------
// Local Storage Token Helpers
// ----------------------------------------------------------------------------

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getStoredProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  const p = localStorage.getItem(PROFILE_KEY);
  if (!p) return null;
  try {
    return JSON.parse(p);
  } catch {
    return null;
  }
}

export function setStoredProfile(profile: Profile | null) {
  if (typeof window === 'undefined') return;
  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(PROFILE_KEY);
  }
}

export function clearStoredAuth() {
  setStoredToken(null);
  setStoredRefreshToken(null);
  setStoredProfile(null);
}

// ----------------------------------------------------------------------------
// Core HTTP Request with Single-Refresh Guard & AbortController
// ----------------------------------------------------------------------------

let isRefreshing = false;

export interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
  idempotencyKey?: string;
  etagMatch?: string;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const endpoint = path.split('?')[0];
  if (!AI_REQUEST_PATHS.has(endpoint)) {
    return requestWithoutTimeout<T>(path, options, isRetry);
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_REQUEST_TIMEOUT_MS);

  try {
    return await requestWithoutTimeout<T>(path, { ...options, signal: controller.signal }, isRetry);
  } catch (err: unknown) {
    if (timedOut) {
      throw new ClientAppError({
        message: 'The AI request timed out after 30 seconds.',
        code: 'REQUEST_TIMEOUT',
        userMessage: 'This AI request took too long and was stopped.',
        retryable: true,
        status: 408,
        actionSuggestion: 'Retry the request. If it times out again, check your connection or try a shorter prompt.'
      });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

async function requestWithoutTimeout<T>(path: string, options: RequestOptions, isRetry: boolean): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  if (options.etagMatch) {
    headers.set('If-Match', options.etagMatch);
  }

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err; // Allow caller to handle clean cancellations
    }
    throw new ClientAppError({
      message: err instanceof Error ? err.message : 'Network connection failure',
      code: 'NETWORK_ERROR',
      userMessage: 'Unable to reach the server. Please check your internet connection.',
      retryable: true,
      status: 0
    });
  }

  // --------------------------------------------------------------------------
  // Infinite 401 Loop Prevention:
  // 401 -> refresh token once -> retry request once -> clean fail
  // --------------------------------------------------------------------------
  if (res.status === 401 && !isRetry) {
    const storedRefresh = getStoredRefreshToken();
    if (storedRefresh && !isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: storedRefresh }),
          signal: options.signal
        });

        const refreshJson = await refreshRes.json().catch(err => {
          if (options.signal?.aborted) throw err;
          return null;
        });

        if (refreshRes.ok && refreshJson?.success && refreshJson?.data?.session) {
          const newAccessToken = refreshJson.data.session.access_token;
          const newRefreshToken = refreshJson.data.session.refresh_token;

          setStoredToken(newAccessToken);
          if (newRefreshToken) setStoredRefreshToken(newRefreshToken);

          isRefreshing = false;
          // Retry the request ONCE with new access token
          return request<T>(path, options, true);
        }
      } catch (err) {
        if (options.signal?.aborted) throw err;
        // Refresh failed
      } finally {
        isRefreshing = false;
      }
    }

    // Refresh was not possible or failed: clean wipe of auth credentials
    clearStoredAuth();
  }

  // Parse JSON response body
  const json: any = await res.json().catch(err => {
    if (options.signal?.aborted) throw err;
    return null;
  });

  if (!res.ok || (json && json.success === false)) {
    const errorObj = json?.error;
    const errorCode = typeof errorObj === 'object' ? errorObj.code : (errorObj || 'API_ERROR');
    const errorMessage = typeof errorObj === 'object' ? errorObj.message : (json?.message || `HTTP ${res.status}`);
    const userMessage = typeof errorObj === 'object' ? errorObj.userMessage : errorMessage;
    const retryable = typeof errorObj === 'object' ? Boolean(errorObj.retryable) : res.status >= 500;
    const requestId = typeof errorObj === 'object' ? errorObj.requestId : res.headers.get('x-request-id') || undefined;
    const issues = typeof errorObj === 'object' ? errorObj.issues : json?.issues;

    throw new ClientAppError({
      message: errorMessage,
      code: errorCode,
      userMessage,
      retryable,
      requestId,
      status: res.status,
      issues
    });
  }

  // Return standard unwrap
  if (json && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

// ----------------------------------------------------------------------------
// LunaLearn Typed API Endpoints
// ----------------------------------------------------------------------------

export const api = {
  // --------------------------------------------------------------------------
  // 1. Auth API
  // --------------------------------------------------------------------------
  auth: {
    async signup(payload: { email: string; password: string; full_name?: string; course?: string; semester?: number }) {
      const data = await request<any>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const token = data?.session?.access_token || data?.data?.session?.access_token;
      const refreshToken = data?.session?.refresh_token || data?.data?.session?.refresh_token;
      const profile = data?.profile || data?.data?.profile;
      if (token) setStoredToken(token);
      if (refreshToken) setStoredRefreshToken(refreshToken);
      if (profile) setStoredProfile(profile);
      return data;
    },

    async login(payload: { email: string; password: string }) {
      const data = await request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const token = data?.session?.access_token || data?.data?.session?.access_token;
      const refreshToken = data?.session?.refresh_token || data?.data?.session?.refresh_token;
      const profile = data?.profile || data?.data?.profile;
      if (token) setStoredToken(token);
      if (refreshToken) setStoredRefreshToken(refreshToken);
      if (profile) setStoredProfile(profile);
      return data;
    },

    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch {
        // Clear local state regardless of server logout outcome
      } finally {
        clearStoredAuth();
      }
    },

    async me(signal?: AbortSignal) {
      const data = await request<{ user: any; profile: Profile }>('/auth/me', { signal });
      if (data?.profile) {
        setStoredProfile(data.profile);
      }
      return data;
    }
  },

  // --------------------------------------------------------------------------
  // 2. Subjects API
  // --------------------------------------------------------------------------
  subjects: {
    list(signal?: AbortSignal) {
      return request<Subject[]>('/subjects', { signal });
    },
    get(id: string, signal?: AbortSignal) {
      return request<Subject>(`/subjects/${encodeURIComponent(id)}`, { signal });
    },
    create(payload: { name: string; code: string; color?: string }) {
      return request<Subject>('/subjects', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ name: string; code: string; color: string }>, etag?: string) {
      return request<Subject>(`/subjects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/subjects/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 3. Units API
  // --------------------------------------------------------------------------
  units: {
    list(subjectId?: string, signal?: AbortSignal) {
      const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
      return request<Unit[]>(`/units${query}`, { signal });
    },
    get(id: string, signal?: AbortSignal) {
      return request<Unit>(`/units/${encodeURIComponent(id)}`, { signal });
    },
    create(payload: { subject_id: string; unit_number: number; title: string }) {
      return request<Unit>('/units', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ unit_number: number; title: string }>, etag?: string) {
      return request<Unit>(`/units/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/units/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 4. Topics API
  // --------------------------------------------------------------------------
  topics: {
    list(unitId?: string, signal?: AbortSignal) {
      const query = unitId ? `?unit_id=${encodeURIComponent(unitId)}` : '';
      return request<Topic[]>(`/topics${query}`, { signal });
    },
    get(id: string, signal?: AbortSignal) {
      return request<Topic>(`/topics/${encodeURIComponent(id)}`, { signal });
    },
    create(payload: { unit_id: string; title: string; status?: string; is_weak?: boolean; mastery_score?: number }) {
      return request<Topic>('/topics', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ title: string; status: string; is_weak: boolean; mastery_score: number }>, etag?: string) {
      return request<Topic>(`/topics/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/topics/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 5. Tasks API
  // --------------------------------------------------------------------------
  tasks: {
    list(params?: { subject_id?: string; is_completed?: boolean }, signal?: AbortSignal) {
      const p = new URLSearchParams();
      if (params?.subject_id) p.set('subject_id', params.subject_id);
      if (params?.is_completed !== undefined) p.set('is_completed', String(params.is_completed));
      const qs = p.toString() ? `?${p.toString()}` : '';
      return request<Task[]>(`/tasks${qs}`, { signal });
    },
    get(id: string, signal?: AbortSignal) {
      return request<Task>(`/tasks/${encodeURIComponent(id)}`, { signal });
    },
    create(payload: { title: string; subject_id?: string | null; type?: string; priority?: string; due_date?: string | null; is_completed?: boolean }) {
      return request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ title: string; subject_id: string | null; type: string; priority: string; due_date: string | null; is_completed: boolean }>, etag?: string) {
      return request<Task>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 6. Exams API
  // --------------------------------------------------------------------------
  exams: {
    list(subjectId?: string, signal?: AbortSignal) {
      const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
      return request<Exam[]>(`/exams${query}`, { signal });
    },
    get(id: string, signal?: AbortSignal) {
      return request<Exam>(`/exams/${encodeURIComponent(id)}`, { signal });
    },
    create(payload: { subject_id: string; title: string; exam_date: string; target_score?: number }) {
      return request<Exam>('/exams', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ title: string; exam_date: string; target_score: number }>, etag?: string) {
      return request<Exam>(`/exams/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/exams/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 7. Materials API
  // --------------------------------------------------------------------------
  activity: {
    get() { return request<{xp:number;level:number;progress_percent:number;next_level_xp:number;events:Array<{id:string;activity_key:string;amount:number;created_at:string}>;sessions:Array<{id:string;subject_id:string;topic_id?:string;duration_minutes:number;started_at:string;ended_at:string;session_type:string;notes?:string}>}>('/activity'); },
    log(payload: {id:string;subject_id:string;topic_id?:string|null;session_type:string;started_at:string;ended_at:string;notes:string;timezone:string}) { return request('/study-sessions',{method:'POST',body:JSON.stringify(payload)}); }
  },
  materials: {
    async content(id: string, signal?: AbortSignal): Promise<Blob> {
      const response = await fetch(`${API_BASE}/materials/${encodeURIComponent(id)}/content`, { headers: { Authorization: `Bearer ${getStoredToken()}` }, signal });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error?.message || 'Original PDF unavailable—upload again.'); }
      return response.blob();
    },
    list(params?: { subject_id?: string; unit_id?: string }, signal?: AbortSignal) {
      const p = new URLSearchParams();
      if (params?.subject_id) p.set('subject_id', params.subject_id);
      if (params?.unit_id) p.set('unit_id', params.unit_id);
      const qs = p.toString() ? `?${p.toString()}` : '';
      return request<Material[]>(`/materials${qs}`, { signal });
    },
    create(payload: { subject_id: string; unit_id?: string | null; name: string; storage_path: string; file_type?: string; size_bytes?: number; processed?: boolean }) {
      return request<Material>('/materials', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    update(id: string, payload: Partial<{ name: string; processed: boolean }>, etag?: string) {
      return request<Material>(`/materials/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        etagMatch: etag
      });
    },
    delete(id: string) {
      return request<{ message: string }>(`/materials/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // 7b. RAG Pipeline API (PDF Upload & Async Job Tracking)
  // --------------------------------------------------------------------------
  rag: {
    /**
     * Synchronous upload (default, waits for completion)
     */
    async upload(formData: FormData, signal?: AbortSignal) {
      return request<any>('/rag/upload', {
        method: 'POST',
        body: formData,
        signal
      });
    },

    /**
     * Asynchronous upload returning 202 Accepted and job tracking id
     */
    async uploadAsync(formData: FormData, signal?: AbortSignal): Promise<{
      jobId: string;
      status: string;
      pollUrl: string;
      message: string;
    }> {
      return request<any>('/rag/upload?async=true', {
        method: 'POST',
        body: formData,
        signal
      });
    },

    /**
     * Poll granular RAG processing state
     */
    pollJob(jobId: string, signal?: AbortSignal) {
      return request<{
        id: string;
        profileId: string;
        subjectId: string;
        fileName: string;
        status: 'UPLOADED' | 'VALIDATING' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'READY' | 'FAILED';
        progressPercent: number;
        error?: string;
        materialId?: string;
        chunksCount?: number;
      }>(`/rag/jobs/${encodeURIComponent(jobId)}`, { signal });
    },

    search(payload: { query: string; subject_id?: string; material_id?: string; top_k?: number }, signal?: AbortSignal) {
      return request<{ query: string; matches_count: number; results: any[] }>('/rag/search', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal
      });
    }
  },

  // --------------------------------------------------------------------------
  // 8. Academic Engine API (Readiness & Risks)
  // --------------------------------------------------------------------------
  academic: {
    getSubjectReadiness(subjectId: string, signal?: AbortSignal) {
      return request<SubjectReadiness>(`/readiness/${encodeURIComponent(subjectId)}`, { signal });
    },
    getAllReadiness(signal?: AbortSignal) {
      return request<SubjectReadiness[]>('/readiness', { signal });
    },
    getSubjectRisks(subjectId: string, signal?: AbortSignal) {
      return request<AcademicRisk[]>(`/risks/${encodeURIComponent(subjectId)}`, { signal });
    },
    getAllRisks(signal?: AbortSignal) {
      return request<AcademicRisk[]>('/risks', { signal });
    }
  },

  // --------------------------------------------------------------------------
  // 9. Adaptive Planner API
  // --------------------------------------------------------------------------
  planner: {
    getContext(subjectId?: string, signal?: AbortSignal, strict = false) {
      const params = new URLSearchParams();
      if (subjectId) params.set('subject_id', subjectId);
      if (strict) params.set('strict', 'true');
      const query = params.size > 0 ? `?${params.toString()}` : '';
      return request<PlannerContextResponse>(`/planner/context${query}`, { signal });
    }
  },

  // --------------------------------------------------------------------------
  // 10. AI Study Assistant API (POST /api/assistant/chat)
  // --------------------------------------------------------------------------
  assistant: {
    chat(
      payload: {
        message: string;
        subject_id?: string | null;
        material_id?: string | null;
        conversation_history?: AssistantChatMessage[];
      },
      signal?: AbortSignal
    ) {
      return request<AssistantChatResponseData>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal
      });
    }
  },

  // --------------------------------------------------------------------------
  // 11. Quiz API (POST /api/quiz/generate, POST /api/quiz/submit)
  // --------------------------------------------------------------------------
  quiz: {
    generate(
      payload: {
        subject_id: string;
        topic_id?: string | null;
        material_id?: string | null;
        difficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
        question_type?: 'multiple_choice' | 'short_answer' | 'mixed';
        num_questions?: number;
      },
      signal?: AbortSignal
    ) {
      return request<GenerateQuizResponseData>('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal
      });
    },

    submit(
      payload: {
        subject_id: string;
        topic_id?: string | null;
        quiz_id: string;
        answers: Array<{
          question_id?: string;
          question?: string;
          user_answer?: string;
          selected_answer?: string;
          correct_answer: string;
          explanation?: string;
          topic_id?: string | null;
          topic_title?: string | null;
        }>;
      },
      idempotencyKey?: string,
      signal?: AbortSignal
    ) {
      // Auto-generate idempotency key if not supplied to prevent double scoring
      const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sub-${Date.now()}`);
      return request<SubmitQuizResponseData>('/quiz/submit', {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey: key,
        signal
      });
    }
  }
};
