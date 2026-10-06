import { z } from 'zod';

// ==============================================================================
// Standardized API Response Envelopes
// ==============================================================================

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  count: number;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  issues?: { field: string; message: string }[];
}

// ==============================================================================
// Subject Schemas
// ==============================================================================

export const CreateSubjectSchema = z.object({
  name: z.string().min(1, { message: 'Subject name is required' }).max(120),
  code: z.string().min(1, { message: 'Subject code is required' }).max(20),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Color must be a valid hex code (e.g. #6C4CE8)' }).default('#6C4CE8')
});

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;

export const UpdateSubjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(20).optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateSubjectInput = z.infer<typeof UpdateSubjectSchema>;

// ==============================================================================
// Unit Schemas
// ==============================================================================

export const CreateUnitSchema = z.object({
  subject_id: z.string().uuid({ message: 'Valid subject_id UUID is required' }),
  unit_number: z.number().int().min(1, { message: 'Unit number must be at least 1' }),
  title: z.string().min(1, { message: 'Unit title is required' }).max(200)
});

export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;

export const UpdateUnitSchema = z.object({
  unit_number: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200).optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;

// ==============================================================================
// Topic Schemas
// ==============================================================================

export const TopicStatusEnum = z.enum(['not_started', 'in_progress', 'completed']);

export const CreateTopicSchema = z.object({
  unit_id: z.string().uuid({ message: 'Valid unit_id UUID is required' }),
  title: z.string().min(1, { message: 'Topic title is required' }).max(200),
  status: TopicStatusEnum.default('not_started'),
  is_weak: z.boolean().default(false),
  mastery_score: z.number().min(0).max(100).default(0),
  estimated_study_hours: z.number().positive().nullable().optional()
});

export type CreateTopicInput = z.infer<typeof CreateTopicSchema>;

export const UpdateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: TopicStatusEnum.optional(),
  is_weak: z.boolean().optional(),
  mastery_score: z.number().min(0).max(100).optional(),
  estimated_study_hours: z.number().positive().nullable().optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateTopicInput = z.infer<typeof UpdateTopicSchema>;

// ==============================================================================
// Task Schemas
// ==============================================================================

export const TaskTypeEnum = z.preprocess(
  v => typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v,
  z.enum(['Assignment', 'Task', 'Revision'])
);
export const PriorityLevelEnum = z.preprocess(
  v => typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v,
  z.enum(['High', 'Medium', 'Low'])
);

export const CreateTaskSchema = z.object({
  id: z.string().uuid().optional(),
  estimated_minutes: z.number().int().positive().max(10080).nullable().optional(),
  title: z.string().trim().min(1, { message: 'Task title is required' }).max(250),
  subject_id: z.string().uuid({ message: 'subject_id must be a valid UUID' }).optional().nullable(),
  type: TaskTypeEnum.default('Task'),
  priority: PriorityLevelEnum.default('Medium'),
  due_date: z.string().datetime({ message: 'due_date must be an ISO 8601 timestamp' }).optional().nullable(),
  is_completed: z.boolean().default(false)
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  estimated_minutes: z.number().int().positive().max(10080).nullable().optional(),
  title: z.string().trim().min(1).max(250).optional(),
  subject_id: z.string().uuid().optional().nullable(),
  type: TaskTypeEnum.optional(),
  priority: PriorityLevelEnum.optional(),
  due_date: z.string().datetime().optional().nullable(),
  is_completed: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ==============================================================================
// Exam Schemas
// ==============================================================================

export const CreateExamSchema = z.object({
  id: z.string().uuid().optional(),
  subject_id: z.string().uuid({ message: 'Valid subject_id UUID is required' }),
  title: z.string().trim().min(1, { message: 'Exam title is required' }).max(200),
  exam_date: z.string().datetime({ message: 'exam_date must be an ISO 8601 timestamp' }).refine(value => Date.parse(value) > Date.now(), 'Exam date must be in the future.'),
  target_score: z.number().min(0).max(100).default(80)
});

export type CreateExamInput = z.infer<typeof CreateExamSchema>;

export const UpdateExamSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  exam_date: z.string().datetime().refine(value => Date.parse(value) > Date.now(), 'Exam date must be in the future.').optional(),
  target_score: z.number().min(0).max(100).optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateExamInput = z.infer<typeof UpdateExamSchema>;

// ==============================================================================
// Material Metadata Schemas (File storage handled by AI/RAG track)
// ==============================================================================

export const MaterialTypeEnum = z.preprocess(
  v => typeof v === 'string' ? (v.toUpperCase() === 'PDF' ? 'PDF' : v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()) : v,
  z.enum(['PDF', 'Notes', 'Slides'])
);

export const CreateMaterialSchema = z.object({
  subject_id: z.string().uuid({ message: 'Valid subject_id UUID is required' }),
  unit_id: z.string().uuid({ message: 'unit_id must be a valid UUID' }).optional().nullable(),
  name: z.string().min(1, { message: 'Material name is required' }).max(250),
  storage_path: z.string().min(1, { message: 'Storage path/key is required' }),
  file_type: MaterialTypeEnum.default('PDF'),
  size_bytes: z.number().int().min(0).default(0),
  processed: z.boolean().default(false)
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;

export const UpdateMaterialSchema = z.object({
  name: z.string().min(1).max(250).optional(),
  unit_id: z.string().uuid().optional().nullable(),
  file_type: MaterialTypeEnum.optional(),
  processed: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided to update' });

export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
