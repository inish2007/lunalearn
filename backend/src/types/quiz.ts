import { z } from 'zod';

export const QuestionTypeEnum = z.enum(['multiple_choice', 'short_answer', 'mixed']);
export type QuestionType = z.infer<typeof QuestionTypeEnum>;

/**
 * Schema for requesting quiz generation (POST /api/quiz/generate).
 */
export const GenerateQuizSchema = z.object({
  subject_id: z.string().uuid('subject_id must be a valid UUID'),
  topic_id: z.string().uuid('topic_id must be a valid UUID').optional().nullable(),
  material_id: z.string().uuid('material_id must be a valid UUID').optional().nullable(),
  question_type: QuestionTypeEnum.optional().default('multiple_choice'),
  num_questions: z.number().int().min(1).max(10).optional().default(5)
});

export type GenerateQuizInput = z.infer<typeof GenerateQuizSchema>;

/**
 * Schema for a single answered question within a quiz submission.
 */
export const SubmitQuizAnswerItemSchema = z
  .object({
    question_id: z.string().optional(),
    question: z.string().optional(),
    user_answer: z.string().optional(),
    selected_answer: z.string().optional(),
    correct_answer: z.string().min(1, 'correct_answer is required'),
    explanation: z.string().optional(),
    topic_id: z.string().uuid().optional().nullable(),
    topic_title: z.string().optional().nullable()
  })
  .refine(
    data => {
      const ans = data.user_answer ?? data.selected_answer;
      return typeof ans === 'string' && ans.trim().length > 0;
    },
    {
      message: 'Either user_answer or selected_answer must be provided as a non-empty string',
      path: ['user_answer']
    }
  );

export type SubmitQuizAnswerItem = z.infer<typeof SubmitQuizAnswerItemSchema>;

/**
 * Schema for submitting quiz answers to be scored and recorded in quiz_results (POST /api/quiz/submit).
 */
export const SubmitQuizSchema = z.object({
  subject_id: z.string().uuid('subject_id must be a valid UUID'),
  topic_id: z.string().uuid('topic_id must be a valid UUID').optional().nullable(),
  answers: z.array(SubmitQuizAnswerItemSchema).min(1, 'At least one answer must be submitted'),
  idempotency_key: z.string().optional()
});

export type SubmitQuizInput = z.infer<typeof SubmitQuizSchema>;

/**
 * Represents a single generated quiz question.
 */
export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'short_answer';
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

/**
 * Successful response data payload for POST /api/quiz/generate.
 */
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

/**
 * Evaluation breakdown for a single submitted question.
 */
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

/**
 * Successful response data payload for POST /api/quiz/submit.
 */
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
    breakdown: {
      topic_completion: number;
      quiz_performance: number;
      revision_activity: number;
      assignment_completion: number;
    };
    active_risks_count: number;
  };
  created_at: string;
}
