import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { PlannerContextService } from '../services/planner-context.service.js';
import { sendSuccess, sendError } from './domain.routes.js';

export async function handlePlannerRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Matches /api/planner/context or /api/planner/context/:subjectId
  const prefix = '/api/planner/context';
  let matches = false;
  let subjectId: string | undefined;

  if (pathname === prefix) {
    matches = true;
    subjectId = url.searchParams.get('subject_id') || undefined;
  } else if (pathname.startsWith(`${prefix}/`)) {
    const sub = pathname.substring(prefix.length + 1).split('/');
    if (sub.length === 1 && sub[0]) {
      matches = true;
      subjectId = decodeURIComponent(sub[0]);
    }
  }

  if (matches) {
    const handler = requireAuth(async (_req, res, ctx) => {
      if (method === 'GET') {
        try {
          const context = await PlannerContextService.getPlannerContext(ctx.db, ctx.user.id, subjectId);
          return sendSuccess(res, context);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error generating adaptive planner context';
          return sendError(res, 'PlannerContextError', msg, 500);
        }
      }
      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on ${pathname}`, 405);
    });

    await handler(req, res);
    return true;
  }

  return false;
}
