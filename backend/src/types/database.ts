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
  id: string; // matches auth.users.id
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  course: string;
  semester: number;
  xp: number;
  level: number;
  preferred_focus_time: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface Task {
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

export interface SubjectReadiness {
  subject_id: string;
  readiness_percentage: number;
  breakdown: ReadinessBreakdown;
  risks: AcademicRisk[];
}

// Database schema representation for Supabase Client generics
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>> & { id: string };
        Update: Partial<Profile>;
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Subject>;
      };
      units: {
        Row: Unit;
        Insert: Omit<Unit, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Unit>;
      };
      topics: {
        Row: Topic;
        Insert: Omit<Topic, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Topic>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Task>;
      };
      exams: {
        Row: Exam;
        Insert: Omit<Exam, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Exam>;
      };
      materials: {
        Row: Material;
        Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Material>;
      };
      document_chunks: {
        Row: DocumentChunk;
        Insert: Omit<DocumentChunk, 'id' | 'created_at'> & { id?: string };
        Update: Partial<DocumentChunk>;
      };
      quiz_results: {
        Row: QuizResult;
        Insert: Omit<QuizResult, 'id' | 'created_at'> & { id?: string };
        Update: Partial<QuizResult>;
      };
      study_sessions: {
        Row: StudySession;
        Insert: Omit<StudySession, 'id' | 'created_at'> & { id?: string };
        Update: Partial<StudySession>;
      };
    };
  };
}
