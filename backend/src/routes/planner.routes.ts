import { SimulationService, SimulationSchema } from '../services/simulation.service.js';
import { parseJsonBody } from './auth.routes.js';
import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { PlannerContextService } from '../services/planner-context.service.js';
import { AppError } from '../types/errors.js';
import { sendSuccess, sendError } from './domain.routes.js';
import { sendStandardError } from '../lib/response.js';

export async function handlePlannerRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  if(pathname==='/api/planner/simulate') {
    await requireAuth(async(req,res,ctx)=>{
      try {
        if(method!=='POST') return sendError(res,'MethodNotAllowed','Use POST',405);
        const parsed=SimulationSchema.safeParse(await parseJsonBody(req));
        if(!parsed.success) throw AppError.validation('Invalid simulation',parsed.error.issues.map(i=>({field:i.path.join('.'),message:i.message})));
        return sendSuccess(res,await SimulationService.simulate(ctx.db,ctx.user.id,parsed.data));
      } catch(err) {return sendStandardError(res,err);}
    })(req,res);return true;
  }
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
          if (subjectId) {
            // Verify subject exists and belongs to user
            const { data: sub } = await (ctx.db as any)
              .from('subjects')
              .select('id')
              .eq('id', subjectId)
              .maybeSingle();

            if (!sub) {
              return sendError(res, 'NotFound', 'Subject not found or inaccessible', 404);
            }
          }

          const context = await PlannerContextService.getPlannerContext(ctx.db, ctx.user.id, subjectId);

          // If query specifies strict validation or generating a schedule
          const strictCheck = url.searchParams.get('strict') === 'true';
          if (strictCheck && context.subjects.length === 0) {
            return sendStandardError(res, AppError.insufficientData(
              'Student has no registered subjects or syllabus topics to generate a study schedule.'
            ));
          }
          if (strictCheck) {
            PlannerContextService.assertPlanFeasible(context);
          }

          return sendSuccess(res, context);
        } catch (err: unknown) {
          if (err instanceof AppError) {
            return sendStandardError(res, err);
          }
          const msg = err instanceof Error ? err.message : 'Error generating adaptive planner context';
          return sendError(res, 'PLANNER_FAILURE', msg, 500);
        }
      }
      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on ${pathname}`, 405);
    });

    await handler(req, res);
    return true;
  }

  return false;
}
