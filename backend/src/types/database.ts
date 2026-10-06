/**
-- ==============================================================================
-- LunaLearn Database TypeScript Definitions
-- Automatically mapped to Phase 1 Supabase Postgres Schema & CONTRACTS
-- ==============================================================================
*/

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TopicStatus = 'not_started' | 'in_progress' | 'completed';
export type TaskType = 'Assignment' | 'Task' | 'Revision';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type MaterialType = 'PDF' | 'Notes' | 'Slides';
export type SessionType = 'focus' | 'quiz' | 'revision' | 'task';

export interface Profile {
  focus_start?: string;
  focus_end?: string;
  timezone?: string;
  id: string; // matches auth.users.id
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  course: string;
  semester: number;
  xp: number;
  level: number;
  preferred_focus_time: string | null;
  available_hours_per_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  profile_id: string;
  name: string;
  code: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  subject_id: string;
  unit_number: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  unit_id: string;
  title: string;
  status: TopicStatus;
  is_weak: boolean;
  mastery_score: number;
  estimated_study_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  estimated_minutes?: number | null;
  id: string;
  profile_id: string;
  subject_id: string | null;
  title: string;
  type: TaskType;
  priority: PriorityLevel;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  profile_id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  target_score: number;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  profile_id: string;
  subject_id: string;
  unit_id: string | null;
  name: string;
  storage_path: string;
  file_type: MaterialType;
  size_bytes: number;
  processed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  material_id: string;
  profile_id: string;
  content: string;
  chunk_index: number;
  page_number: number | null;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuizResult {
  id: string;
  profile_id: string;
  subject_id: string;
  topic_id: string | null;
  score: number;
  total_questions: number;
  correct_answers: number;
  weak_topics_identified: string[];
  created_at: string;
}

export interface StudySession {
  id: string;
  profile_id: string;
  subject_id: string | null;
  topic_id: string | null;
  duration_minutes: number;
  session_type: SessionType;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

// ==============================================================================
// Academic Engine Contracts (plan.md Layer 4 & person-2-backend/AGENTS.md)
// ==============================================================================

export type RiskType = 'HIGH_EXAM_RISK' | 'DEADLINE_RISK' | 'PERFORMANCE_RISK' | 'WORKLOAD_RISK';
export type RiskSeverity = 'high' | 'medium' | 'low';

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

export interface ReadinessBasis {
  topics: { completed: number; total: number };
  quizzes: { count: number; limit: number };
  revision: { minutes: number; benchmark_minutes: number; window_start: string; window_end: string };
  assignments: { completed: number; total: number };
  weights: ReadinessBreakdown;
  calculated_at: string;
}

export interface SubjectReadiness {
  basis?: ReadinessBasis;
  subject_id: string;
  readiness_percentage: number;
  breakdown: ReadinessBreakdown;
  risks: AcademicRisk[];
}

// ==============================================================================
// Planner Context Contracts (Phase 5 — L7 Adaptive Planner Unified Feed)
// ==============================================================================

export interface StudyTimeSettings {
  focus_start?: string;
  focus_end?: string;
  timezone?: string;
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
  estimated_study_hours: number | null;
}

export interface TaskSummary {
  estimated_minutes?: number | null;
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
  readiness_basis?: ReadinessBasis;
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
  study_plan?: {status:'ready'|'insufficient_data'|'constraint_conflict';blocks:Array<{id:string;subject_id:string|null;topic_id?:string;task_id?:string;title:string;reason:string;start:string;end:string;minutes:number}>;issues:string[];required_hours:number;available_hours:number;generated_at:string};
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

// Database schema representation for Supabase Client generics
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          course?: string;
          semester?: number;
          xp?: number;
          level?: number;
          preferred_focus_time?: string | null;
          available_hours_per_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      subjects: {
        Row: Subject;
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          code: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Subject>;
        Relationships: [];
      };
      units: {
        Row: Unit;
        Insert: {
          id?: string;
          subject_id: string;
          unit_number: number;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Unit>;
        Relationships: [];
      };
      topics: {
        Row: Topic;
        Insert: {
          id?: string;
          unit_id: string;
          title: string;
          status?: TopicStatus;
          is_weak?: boolean;
          mastery_score?: number;
          estimated_study_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Topic>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: {
          id?: string;
          profile_id: string;
          subject_id?: string | null;
          title: string;
          type?: TaskType;
          priority?: PriorityLevel;
          due_date?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Task>;
        Relationships: [];
      };
      exams: {
        Row: Exam;
        Insert: {
          id?: string;
          profile_id: string;
          subject_id: string;
          title: string;
          exam_date: string;
          target_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Exam>;
        Relationships: [];
      };
      materials: {
        Row: Material;
        Insert: {
          id?: string;
          profile_id: string;
          subject_id: string;
          unit_id?: string | null;
          name: string;
          storage_path: string;
          file_type?: MaterialType;
          size_bytes?: number;
          processed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Material>;
        Relationships: [];
      };
      document_chunks: {
        Row: DocumentChunk;
        Insert: {
          id?: string;
          material_id: string;
          profile_id: string;
          content: string;
          chunk_index: number;
          page_number?: number | null;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<DocumentChunk>;
        Relationships: [];
      };
      quiz_results: {
        Row: QuizResult;
        Insert: {
          id?: string;
          profile_id: string;
          subject_id: string;
          topic_id?: string | null;
          score: number;
          total_questions: number;
          correct_answers: number;
          weak_topics_identified?: string[];
          created_at?: string;
        };
        Update: Partial<QuizResult>;
        Relationships: [];
      };
      study_sessions: {
        Row: StudySession;
        Insert: {
          id?: string;
          profile_id: string;
          subject_id?: string | null;
          topic_id?: string | null;
          duration_minutes: number;
          session_type?: SessionType;
          notes?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<StudySession>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          filter_profile_id?: string;
          filter_subject_id?: string | null;
          filter_material_id?: string | null;
          similarity_threshold?: number;
        };
        Returns: {
          id: string;
          material_id: string;
          content: string;
          chunk_index: number;
          page_number: number | null;
          metadata: Record<string, unknown>;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

