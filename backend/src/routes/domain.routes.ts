import { StorageService } from '../services/storage.service.js';
import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseJsonBody } from './auth.routes.js';
import {
  CreateSubjectSchema, UpdateSubjectSchema,
  CreateUnitSchema, UpdateUnitSchema,
  CreateTopicSchema, UpdateTopicSchema,
  CreateTaskSchema, UpdateTaskSchema,
  CreateExamSchema, UpdateExamSchema,
  CreateMaterialSchema, UpdateMaterialSchema
} from '../types/domain.js';

import { AppError } from '../types/errors.js';
import { sendStandardSuccess, sendStandardError } from '../lib/response.js';

export function sendSuccess<T>(res: http.ServerResponse, data: T, statusCode = 200, message?: string) {
  const headers: Record<string, string> = {};
  if (data && typeof data === 'object' && 'updated_at' in (data as any)) {
    const updatedAt = (data as any).updated_at;
    if (updatedAt) {
      headers['ETag'] = `"${updatedAt}"`;
    }
  }
  sendStandardSuccess(res, data, statusCode, { message, headers });
}

export function sendList<T>(res: http.ServerResponse, data: T[], count: number, statusCode = 200, message?: string) {
  sendStandardSuccess(res, data, statusCode, { count, message });
}

export function sendError(res: http.ServerResponse, error: string, message: string, statusCode = 400, issues?: { field: string; message: string }[]) {
  let appError: AppError;
  const isConflict = statusCode === 409 || error === 'Conflict';
  const isNotFound = statusCode === 404 || error === 'NotFound';
  const isForbidden = statusCode === 403 || error === 'Forbidden';
  const isUnauthorized = statusCode === 401 || error === 'Unauthorized';
  const isPayloadTooLarge = statusCode === 413 || error === 'PayloadTooLarge';
  const isUnsupportedMediaType = statusCode === 415 || error === 'UnsupportedMediaType';

  if (isConflict) {
    appError = AppError.conflict(message);
  } else if (isNotFound) {
    appError = AppError.notFound(message);
  } else if (isForbidden) {
    appError = AppError.forbidden(message);
  } else if (isUnauthorized) {
    appError = AppError.unauthorized(message);
  } else if (isPayloadTooLarge) {
    appError = AppError.payloadTooLarge(message);
  } else if (isUnsupportedMediaType) {
    appError = AppError.unsupportedMediaType(message);
  } else if (statusCode >= 500) {
    appError = AppError.internal(message);
  } else {
    appError = AppError.validation(message, issues);
  }

  sendStandardError(res, appError, undefined, { statusCodeOverride: statusCode });
}

// Regex route matcher helper
// Matches /api/:resource or /api/:resource/:id
export function matchRoute(pathname: string, resource: string): { matches: boolean; id?: string } {
  const prefix = `/api/${resource}`;
  if (pathname === prefix) {
    return { matches: true };
  }
  if (pathname.startsWith(`${prefix}/`)) {
    const sub = pathname.substring(prefix.length + 1).split('/');
    if (sub.length === 1 && sub[0]) {
      return { matches: true, id: decodeURIComponent(sub[0]) };
    }
  }
  return { matches: false };
}

// Helper to access scoped table builder cleanly
function table(db: any, tableName: string) {
  return db.from(tableName);
}

/**
 * Checks If-Match header against the resource's updated_at timestamp.
 * Returns false and sends 409 Conflict if there is a version mismatch.
 */
async function checkOptimisticConcurrency(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: any,
  tableName: string,
  id: string
): Promise<boolean> {
  const ifMatch = req.headers['if-match'];
  if (!ifMatch || ifMatch === '*') return true;
  const { data: current } = await table(db, tableName).select('updated_at').eq('id', id).maybeSingle();
  if (current?.updated_at) {
    const cleanMatch = ifMatch.replace(/^"|"$/g, '');
    if (cleanMatch !== current.updated_at) {
      sendError(res, 'Conflict', 'Resource version mismatch: stale update prevented by optimistic concurrency control.', 409);
      return false;
    }
  }
  return true;
}

// ==============================================================================
// Domain Routes Dispatcher
// ==============================================================================

export async function handleDomainRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  const contentMatch = pathname.match(/^\/api\/materials\/([^/]+)\/content$/);
  if (contentMatch) {
    await requireAuth(async (_req, res, ctx) => {
      try {
        if (method !== 'GET') return sendError(res, 'MethodNotAllowed', 'Use GET.', 405);
        const { data: material, error } = await table(ctx.db, 'materials').select('*').eq('id', decodeURIComponent(contentMatch[1])).maybeSingle();
        if (error) throw AppError.internal('Material lookup failed', error);
        if (!material) throw AppError.notFound('Material not found.');
        const bytes = await StorageService.readPdf(ctx.db, material.storage_path);
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': bytes.length, 'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(material.name), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(bytes);
      } catch (err) { sendStandardError(res, err); }
    })(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 1. SUBJECTS CRUD (/api/subjects, /api/subjects/:id)
  // ----------------------------------------------------------------------------
  const subjectMatch = matchRoute(pathname, 'subjects');
  if (subjectMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = subjectMatch.id;

      // GET /api/subjects
      if (!id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'subjects')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/subjects
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateSubjectSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid subject input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const { data, error } = await table(ctx.db, 'subjects')
          .insert({
            profile_id: ctx.user.id,
            name: parsed.data.name,
            code: parsed.data.code,
            color: parsed.data.color
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Subject created successfully');
      }

      // GET /api/subjects/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'subjects')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Subject not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/subjects/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateSubjectSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid subject update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'subjects', id);
        if (!allowed) return;

        const { data, error } = await table(ctx.db, 'subjects')
          .update(parsed.data)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Subject not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Subject updated successfully');
      }

      // DELETE /api/subjects/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'subjects')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Subject not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'subjects')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Subject deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/subjects`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 2. UNITS CRUD (/api/units, /api/units/:id)
  // ----------------------------------------------------------------------------
  const unitMatch = matchRoute(pathname, 'units');
  if (unitMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = unitMatch.id;

      // GET /api/units (?subject_id=xxx)
      if (!id && method === 'GET') {
        const subjectId = url.searchParams.get('subject_id');
        let query = table(ctx.db, 'units').select('*').order('unit_number', { ascending: true });
        if (subjectId) query = query.eq('subject_id', subjectId);

        const { data, error } = await query;
        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/units
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateUnitSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid unit input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        // Verify parent subject belongs to caller
        const { data: parentSubject } = await table(ctx.db, 'subjects')
          .select('id')
          .eq('id', parsed.data.subject_id)
          .maybeSingle();

        if (!parentSubject) {
          return sendError(res, 'Forbidden', 'Subject does not exist or does not belong to you', 403);
        }

        const { data, error } = await table(ctx.db, 'units')
          .insert({
            subject_id: parsed.data.subject_id,
            unit_number: parsed.data.unit_number,
            title: parsed.data.title
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Unit created successfully');
      }

      // GET /api/units/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'units')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Unit not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/units/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateUnitSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid unit update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'units', id);
        if (!allowed) return;

        const { data, error } = await table(ctx.db, 'units')
          .update(parsed.data)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Unit not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Unit updated successfully');
      }

      // DELETE /api/units/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'units')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Unit not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'units')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Unit deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/units`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 3. TOPICS CRUD (/api/topics, /api/topics/:id)
  // ----------------------------------------------------------------------------
  const topicMatch = matchRoute(pathname, 'topics');
  if (topicMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = topicMatch.id;

      // GET /api/topics (?unit_id=xxx)
      if (!id && method === 'GET') {
        const unitId = url.searchParams.get('unit_id');
        let query = table(ctx.db, 'topics').select('*').order('created_at', { ascending: true });
        if (unitId) query = query.eq('unit_id', unitId);

        const { data, error } = await query;
        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/topics
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateTopicSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid topic input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        // Verify parent unit belongs to caller
        const { data: parentUnit } = await table(ctx.db, 'units')
          .select('id')
          .eq('id', parsed.data.unit_id)
          .maybeSingle();

        if (!parentUnit) {
          return sendError(res, 'Forbidden', 'Unit does not exist or does not belong to you', 403);
        }

        const { data, error } = await table(ctx.db, 'topics')
          .insert({
            unit_id: parsed.data.unit_id,
            title: parsed.data.title,
            status: parsed.data.status,
            is_weak: parsed.data.is_weak,
            mastery_score: parsed.data.mastery_score,
            estimated_study_hours: parsed.data.estimated_study_hours ?? null
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Topic created successfully');
      }

      // GET /api/topics/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'topics')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Topic not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/topics/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateTopicSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid topic update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'topics', id);
        if (!allowed) return;

        const { data, error } = await table(ctx.db, 'topics')
          .update(parsed.data)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Topic not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Topic updated successfully');
      }

      // DELETE /api/topics/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'topics')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Topic not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'topics')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Topic deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/topics`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 4. TASKS CRUD (/api/tasks, /api/tasks/:id)
  // ----------------------------------------------------------------------------
  const taskMatch = matchRoute(pathname, 'tasks');
  if (taskMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = taskMatch.id;

      // GET /api/tasks (?subject_id=xxx&is_completed=xxx)
      if (!id && method === 'GET') {
        const subjectId = url.searchParams.get('subject_id');
        const isCompletedParam = url.searchParams.get('is_completed');

        let query = table(ctx.db, 'tasks')
          .select('*')
          .order('due_date', { ascending: true, nullsFirst: false });

        if (subjectId) query = query.eq('subject_id', subjectId);
        if (isCompletedParam !== null) {
          query = query.eq('is_completed', isCompletedParam === 'true');
        }

        const { data, error } = await query;
        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/tasks
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateTaskSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid task input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        if (parsed.data.subject_id) {
          const { data: parentSubject } = await table(ctx.db, 'subjects')
            .select('id')
            .eq('id', parsed.data.subject_id)
            .maybeSingle();

          if (!parentSubject) {
            return sendError(res, 'Forbidden', 'Subject does not exist or does not belong to you', 403);
          }
        }

        const { data, error } = await table(ctx.db, 'tasks')
          .insert({
            profile_id: ctx.user.id,
            subject_id: parsed.data.subject_id ?? null,
            title: parsed.data.title,
            type: parsed.data.type,
            priority: parsed.data.priority,
            due_date: parsed.data.due_date ?? null,
            estimated_minutes: parsed.data.estimated_minutes ?? null,
            is_completed: parsed.data.is_completed
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Task created successfully');
      }

      // GET /api/tasks/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'tasks')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Task not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/tasks/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateTaskSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid task update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'tasks', id);
        if (!allowed) return;

        const updatePayload: Record<string, unknown> = { ...parsed.data };
        if (parsed.data.is_completed === true) {
          updatePayload.completed_at = new Date().toISOString();
        } else if (parsed.data.is_completed === false) {
          updatePayload.completed_at = null;
        }

        const { data, error } = await table(ctx.db, 'tasks')
          .update(updatePayload)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Task not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Task updated successfully');
      }

      // DELETE /api/tasks/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'tasks')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Task not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'tasks')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Task deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/tasks`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 5. EXAMS CRUD (/api/exams, /api/exams/:id)
  // ----------------------------------------------------------------------------
  const examMatch = matchRoute(pathname, 'exams');
  if (examMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = examMatch.id;

      // GET /api/exams (?subject_id=xxx)
      if (!id && method === 'GET') {
        const subjectId = url.searchParams.get('subject_id');
        let query = table(ctx.db, 'exams')
          .select('*')
          .order('exam_date', { ascending: true });

        if (subjectId) query = query.eq('subject_id', subjectId);

        const { data, error } = await query;
        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/exams
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateExamSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid exam input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const { data: parentSubject } = await table(ctx.db, 'subjects')
          .select('id')
          .eq('id', parsed.data.subject_id)
          .maybeSingle();

        if (!parentSubject) {
          return sendError(res, 'Forbidden', 'Subject does not exist or does not belong to you', 403);
        }

        const { data, error } = await table(ctx.db, 'exams')
          .insert({
            profile_id: ctx.user.id,
            subject_id: parsed.data.subject_id,
            title: parsed.data.title,
            exam_date: parsed.data.exam_date,
            target_score: parsed.data.target_score
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Exam created successfully');
      }

      // GET /api/exams/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'exams')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Exam not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/exams/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateExamSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid exam update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'exams', id);
        if (!allowed) return;

        const { data, error } = await table(ctx.db, 'exams')
          .update(parsed.data)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Exam not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Exam updated successfully');
      }

      // DELETE /api/exams/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'exams')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Exam not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'exams')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Exam deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/exams`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 6. MATERIALS METADATA CRUD (/api/materials, /api/materials/:id)
  // (File storage/embeddings handled by AI/RAG track)
  // ----------------------------------------------------------------------------
  const materialMatch = matchRoute(pathname, 'materials');
  if (materialMatch.matches) {
    const handler = requireAuth(async (req, res, ctx) => {
      const id = materialMatch.id;

      // GET /api/materials (?subject_id=xxx&unit_id=xxx)
      if (!id && method === 'GET') {
        const subjectId = url.searchParams.get('subject_id');
        const unitId = url.searchParams.get('unit_id');

        let query = table(ctx.db, 'materials')
          .select('*')
          .order('created_at', { ascending: false });

        if (subjectId) query = query.eq('subject_id', subjectId);
        if (unitId) query = query.eq('unit_id', unitId);

        const { data, error } = await query;
        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendList(res, data || [], (data || []).length);
      }

      // POST /api/materials
      if (!id && method === 'POST') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = CreateMaterialSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid material input', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const { data: parentSubject } = await table(ctx.db, 'subjects')
          .select('id')
          .eq('id', parsed.data.subject_id)
          .maybeSingle();

        if (!parentSubject) {
          return sendError(res, 'Forbidden', 'Subject does not exist or does not belong to you', 403);
        }

        if (parsed.data.unit_id) {
          const { data: parentUnit } = await table(ctx.db, 'units')
            .select('id')
            .eq('id', parsed.data.unit_id)
            .maybeSingle();

          if (!parentUnit) {
            return sendError(res, 'Forbidden', 'Unit does not exist or does not belong to you', 403);
          }
        }

        const { data, error } = await table(ctx.db, 'materials')
          .insert({
            profile_id: ctx.user.id,
            subject_id: parsed.data.subject_id,
            unit_id: parsed.data.unit_id ?? null,
            name: parsed.data.name,
            storage_path: parsed.data.storage_path,
            file_type: parsed.data.file_type,
            size_bytes: parsed.data.size_bytes,
            processed: parsed.data.processed
          })
          .select('*')
          .single();

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, data, 201, 'Material metadata created successfully');
      }

      // GET /api/materials/:id
      if (id && method === 'GET') {
        const { data, error } = await table(ctx.db, 'materials')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Material not found', 404);
        return sendSuccess(res, data);
      }

      // PATCH /api/materials/:id
      if (id && method === 'PATCH') {
        let body: unknown;
        try {
          body = await parseJsonBody(req);
        } catch (err: unknown) {
          return sendError(res, 'ValidationError', err instanceof Error ? err.message : 'Invalid JSON body', 400);
        }
        const parsed = UpdateMaterialSchema.safeParse(body);
        if (!parsed.success) {
          return sendError(res, 'ValidationError', 'Invalid material update payload', 400, parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
        }

        const allowed = await checkOptimisticConcurrency(req, res, ctx.db, 'materials', id);
        if (!allowed) return;

        const { data, error } = await table(ctx.db, 'materials')
          .update(parsed.data)
          .eq('id', id)
          .select('*')
          .single();

        if (error || !data) return sendError(res, 'NotFound', 'Material not found or update unauthorized', 404);
        return sendSuccess(res, data, 200, 'Material metadata updated successfully');
      }

      // DELETE /api/materials/:id
      if (id && method === 'DELETE') {
        const { data: existing } = await table(ctx.db, 'materials')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (!existing) return sendError(res, 'NotFound', 'Material not found or unauthorized', 404);

        const { error } = await table(ctx.db, 'materials')
          .delete()
          .eq('id', id);

        if (error) return sendError(res, 'DatabaseError', error.message, 500);
        return sendSuccess(res, { deletedId: id }, 200, 'Material deleted successfully');
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/materials`, 405);
    });

    await handler(req, res);
    return true;
  }

  return false;
}
