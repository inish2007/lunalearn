import { z } from 'zod';

/**
 * LunaLearn — AI Study Assistant Types & Contracts (Phase 3)
 */

export const ChatMessageRoleEnum = z.enum(['user', 'assistant', 'system']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleEnum>;

export const ChatMessageSchema = z.object({
  role: ChatMessageRoleEnum,
  content: z.string().min(1)
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AssistantChatSchema = z.object({
  message: z.string().min(1, { message: 'Message cannot be empty' }).max(4000),
  subject_id: z.preprocess(
    val => (val === '' ? null : val),
    z.string().uuid({ message: 'subject_id must be a valid UUID' }).optional().nullable()
  ),
  material_id: z.preprocess(
    val => (val === '' ? null : val),
    z.string().uuid({ message: 'material_id must be a valid UUID' }).optional().nullable()
  ),
  conversation_history: z.array(ChatMessageSchema).max(20).optional().default([])
});

export type AssistantChatInput = z.infer<typeof AssistantChatSchema>;

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
