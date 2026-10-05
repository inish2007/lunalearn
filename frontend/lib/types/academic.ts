/**
 * LunaLearn Academic Frontend Type Definitions
 * Strictly aligned with backend database schema & CONTRACTS.md
 */

export type TopicStatus = 'not_started' | 'in_progress' | 'completed';
export type TaskType = 'Assignment' | 'Task' | 'Revision';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type MaterialType = 'PDF' | 'Notes' | 'Slides';
export type SessionType = 'focus' | 'quiz' | 'revision' | 'task';
export type RiskType = 'HIGH_EXAM_RISK' | 'DEADLINE_RISK' | 'PERFORMANCE_RISK' | 'WORKLOAD_RISK';
export type RiskSeverity = 'high' | 'medium' | 'low';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  course: string;
  semester: number;
  xp: number;
  level: number;
  preferred_focus_time: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  profile_id?: string;
  name: string;
  code: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface Unit {
  id: string;
  subject_id: string;
  unit_number: number;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface Topic {
  id: string;
  unit_id: string;
  title: string;
  status: TopicStatus;
  is_weak: boolean;
  mastery_score: number;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  profile_id?: string;
  subject_id?: string | null;
  title: string;
  type: TaskType;
  priority: PriorityLevel;
  due_date: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Exam {
  id: string;
  profile_id?: string;
  subject_id: string;
  title: string;
  exam_date: string;
  target_score: number;
  created_at?: string;
  updated_at?: string;
}

export interface Material {
  id: string;
  profile_id?: string;
  subject_id: string;
  unit_id?: string | null;
  name: string;
  storage_path: string;
  file_type: MaterialType;
  size_bytes: number;
  processed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QuizResult {
  id: string;
  profile_id?: string;
  subject_id: string;
  topic_id?: string | null;
  score: number;
  total_questions: number;
  correct_answers: number;
  weak_topics_identified: string[];
  created_at: string;
}

export interface AcademicRisk {
  type: RiskType;
  reason: string;
  severity: RiskSeverity;
  subject_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ReadinessBreakdown {
  topic_completion: number;      // 40% weight
  quiz_performance: number;      // 30% weight
  revision_activity: number;     // 20% weight
  assignment_completion: number; // 10% weight
}

export interface SubjectReadiness {
  subject_id: string;
  readiness_percentage: number;
  breakdown: ReadinessBreakdown;
  risks: AcademicRisk[];
}

export interface StudyTimeSettings {
  preferred_focus_time: string;
  daily_study_target_minutes: number;
  weekly_study_target_minutes: number;
  available_hours_per_day: number;
}

export interface SubjectExamSummary {
  id: string;
  title: string;
  exam_date: string;
  days_until_exam: number;
  target_score: number;
}

export interface TopicSummary {
  id: string;
  unit_id: string;
  unit_title?: string;
  title: string;
  status: TopicStatus;
  is_weak: boolean;
  mastery_score: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  type: TaskType;
  priority: PriorityLevel;
  due_date: string | null;
  days_until_due: number | null;
  is_completed: boolean;
}

export interface QuizPerformanceSummary {
  id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  weak_topics_identified: string[];
  created_at: string;
}

export interface SubjectPlannerContext {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_color: string;
  readiness_percentage: number;
  readiness_breakdown: ReadinessBreakdown;
  exams: SubjectExamSummary[];
  weak_and_unfinished_topics: TopicSummary[];
  pending_tasks: TaskSummary[];
  recent_quiz_performance: QuizPerformanceSummary[];
  active_risks: AcademicRisk[];
}

export interface PlannerContextResponse {
  student: {
    id: string;
    full_name: string | null;
    course: string;
    semester: number;
    study_time_settings: StudyTimeSettings;
  };
  subjects: SubjectPlannerContext[];
  unassigned_pending_tasks: TaskSummary[];
  global_risks: AcademicRisk[];
  generated_at: string;
}

// ============================================================================
// AI Study Assistant (POST /api/assistant/chat) — CONTRACTS.md § (Phase 3)
// ============================================================================

export interface AssistantSourceChunk {
  material_id: string;
  material_name: string;
  storage_path: string;
  page_number: number | null;
  chunk_index: number;
  similarity: number;
  preview: string;
}

export interface AssistantAcademicContextSummary {
  has_academic_profile: boolean;
  student_name: string | null;
  total_subjects: number;
  active_subject?: {
    id: string;
    name: string;
    code: string;
    readiness_percentage: number;
    days_until_exam: number | null;
    weak_topics: string[];
    pending_tasks_count: number;
  };
  global_risks_count: number;
}

export interface AssistantChatResponseData {
  answer: string;
  sources: AssistantSourceChunk[];
  academic_context: AssistantAcademicContextSummary;
  model: string;
  is_fallback?: boolean;
  notice?: string;
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================================
// Quiz Generation & Scoring (POST /api/quiz/generate, POST /api/quiz/submit)
// ============================================================================

export type QuizQuestionType = 'multiple_choice' | 'short_answer';

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuizQuestionType;
  options?: string[];
  correct_answer: string;
  explanation: string;
  topic_id?: string | null;
  topic_title: string;
  source?: {
    material_id?: string;
    material_name?: string;
    page_number?: number | null;
    similarity?: number;
  } | null;
}

export interface GenerateQuizResponseData {
  quiz_id: string;
  subject_id: string;
  subject_name: string;
  topic_id?: string | null;
  topic_title?: string | null;
  grounded: boolean;
  grounding_type: 'retrieved_chunks' | 'topic_syllabus';
  source_materials: Array<{
    material_id: string;
    material_name: string;
    page_number: number | null;
  }>;
  questions: QuizQuestion[];
  model: string;
  is_fallback?: boolean;
  notice?: string;
}

export interface QuizQuestionEvaluation {
  question_id?: string;
  question?: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string;
  topic_id?: string | null;
  topic_title?: string | null;
}

export interface SubmitQuizResponseData {
  quiz_result_id: string;
  subject_id: string;
  topic_id?: string | null;
  score: number;
  total_questions: number;
  correct_answers: number;
  passed: boolean;
  weak_topics_identified: string[];
  question_evaluations: QuizQuestionEvaluation[];
  updated_readiness?: {
    readiness_percentage: number;
    breakdown: ReadinessBreakdown;
    active_risks_count: number;
  };
  created_at: string;
}

// ============================================================================
// Production Async State & Error Handling
// ============================================================================

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'retrying' | 'degraded';

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  requestId?: string;
  issues?: { field: string; message: string }[];
  actionSuggestion?: string;
}

export type AsyncState<T> = {
  status: AsyncStatus;
  data?: T;
  error?: AppError;
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
    requestId?: string;
    issues?: { field: string; message: string }[];
  };
}
