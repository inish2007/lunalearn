import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AcademicEngineService } from '../services/academic-engine.service.js';
import { matchRoute, sendSuccess, sendList, sendError } from './domain.routes.js';

export async function handleAcademicRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // ----------------------------------------------------------------------------
  // 1. READINESS ENDPOINTS (/api/readiness, /api/readiness/:subjectId)
  // ----------------------------------------------------------------------------
  const readinessMatch = matchRoute(pathname, 'readiness');
  if (readinessMatch.matches) {
    const handler = requireAuth(async (_req, res, ctx) => {
      const subjectId = readinessMatch.id;

      // GET /api/readiness/:subjectId
      if (subjectId && method === 'GET') {
        try {
          const readiness = await AcademicEngineService.getSubjectReadiness(ctx.db, subjectId);
          return sendSuccess(res, readiness);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error calculating readiness';
          return sendError(res, 'CalculationError', msg, 500);
        }
      }

      // GET /api/readiness
      if (!subjectId && method === 'GET') {
        try {
          const list = await AcademicEngineService.getAllSubjectsReadiness(ctx.db);
          return sendList(res, list, list.length);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error calculating readiness list';
          return sendError(res, 'CalculationError', msg, 500);
        }
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/readiness`, 405);
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 2. RISKS ENDPOINTS (/api/risks, /api/risks/:subjectId)
  // ----------------------------------------------------------------------------
  const riskMatch = matchRoute(pathname, 'risks');
  if (riskMatch.matches) {
    const handler = requireAuth(async (_req, res, ctx) => {
      const subjectId = riskMatch.id;

      // GET /api/risks/:subjectId
      if (subjectId && method === 'GET') {
        try {
          const risks = await AcademicEngineService.evaluateSubjectRisks(ctx.db, subjectId);
          return sendList(res, risks, risks.length);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error evaluating risks';
          return sendError(res, 'EvaluationError', msg, 500);
        }
      }

      // GET /api/risks
      if (!subjectId && method === 'GET') {
        try {
          const risks = await AcademicEngineService.evaluateAllStudentRisks(ctx.db);
          return sendList(res, risks, risks.length);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error evaluating all student risks';
          return sendError(res, 'EvaluationError', msg, 500);
        }
      }

      return sendError(res, 'MethodNotAllowed', `Method ${method} not supported on /api/risks`, 405);
    });

    await handler(req, res);
    return true;
  }

  return false;
}
