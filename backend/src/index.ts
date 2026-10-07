import { handleActivityRoutes } from './routes/activity.routes.js';
import http from 'http';
import { env } from './config/env.js';
import { handleAuthRoutes } from './routes/auth.routes.js';
import { handleDomainRoutes } from './routes/domain.routes.js';
import { handleAcademicRoutes } from './routes/academic.routes.js';
import { handlePlannerRoutes } from './routes/planner.routes.js';
import { handleRagRoutes } from './routes/rag.routes.js';
import { handleAssistantRoutes } from './routes/assistant.routes.js';
import { handleQuizRoutes } from './routes/quiz.routes.js';
import { applyRateLimiter } from './middleware/rate-limiter.js';
import { sendStandardSuccess, sendStandardError, getOrCreateRequestId } from './lib/response.js';
import { AppError } from './types/errors.js';
import { geminiCircuitBreaker, supabaseCircuitBreaker } from './lib/circuit-breaker.js';
import { supabase, isLiveSupabaseConfigured } from './lib/supabase.js';
import { logger } from './lib/logger.js';

export * from './config/env.js';
export * from './lib/supabase.js';
export * from './lib/scoped-client.js';
export * from './lib/circuit-breaker.js';
export * from './lib/logger.js';
export * from './lib/response.js';
export * from './types/errors.js';
export * from './types/database.js';
export * from './types/auth.js';
export * from './types/domain.js';
export * from './types/rag.js';
export * from './types/assistant.js';
export * from './types/quiz.js';
export * from './services/auth.service.js';
export * from './services/academic-engine.service.js';
export * from './services/planner-context.service.js';
export * from './services/storage.service.js';
export * from './services/pdf.service.js';
export * from './services/chunking.service.js';
export * from './services/rag-material.service.js';
export * from './services/rag-jobs.service.js';
export * from './services/embedding.service.js';
export * from './services/semantic-search.service.js';
export * from './services/study-assistant.service.js';
export * from './services/quiz.service.js';
export * from './middleware/auth.middleware.js';
export * from './middleware/rate-limiter.js';
export * from './routes/domain.routes.js';
export * from './routes/academic.routes.js';
export * from './routes/planner.routes.js';
export * from './routes/rag.routes.js';
export * from './routes/assistant.routes.js';
export * from './routes/quiz.routes.js';

const PORT = parseInt(env.PORT, 10);

export const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const requestId = getOrCreateRequestId(req);
  res.setHeader('X-Request-Id', requestId);

  try {
    // Global CORS headers
    const origin = req.headers.origin;
    const origins = (env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    const isDev = env.NODE_ENV !== 'production';

    const isOriginAllowed = (candOrigin?: string): boolean => {
      if (!candOrigin) return true;
      if (origins.includes(candOrigin)) return true;
      if (isDev) {
        try {
          const u = new URL(candOrigin);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1' || u.hostname === '[::1]') {
            return true;
          }
        } catch {
          return false;
        }
      }
      return false;
    };

    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (origin && !isOriginAllowed(origin)) {
      sendStandardError(res, AppError.forbidden('Origin is not allowed'), requestId);
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, If-Match, X-Request-Id');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After, ETag, Idempotency-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate Limiting Protection (sensitive endpoints: login, chat, quiz gen, uploads)
    const allowed = applyRateLimiter(req, res);
    if (!allowed) {
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Base Liveness Health Check (Process Status)
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      const memory = process.memoryUsage();
      sendStandardSuccess(
        res,
        {
          status: 'ok',
          service: 'lunalearn-backend',
          uptimeSec: Math.round(process.uptime()),
          memory: {
            rssMb: Math.round(memory.rss / (1024 * 1024)),
            heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024))
          },
          nodeVersion: process.version,
          environment: env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        200,
        { requestId }
      );
      return;
    }

    // Dependency Readiness Check (Supabase DB & AI Provider)
    if (url.pathname === '/ready' || url.pathname === '/api/ready') {
      let dbReady = false;
      let dbError: string | null = null;

      try {
        if (isLiveSupabaseConfigured) {
          const { error } = await supabase.from('profiles').select('id').limit(1);
          if (error) {
            dbError = error.message;
          } else {
            dbReady = true;
          }
        } else {
          // Dev local store ready
          dbReady = true;
        }
      } catch (err: unknown) {
        dbError = err instanceof Error ? err.message : String(err);
      }

      const geminiApiKeyPresent = Boolean(env.GEMINI_API_KEY && !env.GEMINI_API_KEY.includes('placeholder'));
      const geminiBreakerState = geminiCircuitBreaker.getState();
      const supabaseBreakerState = supabaseCircuitBreaker.getState();

      const isReady = dbReady && geminiBreakerState !== 'OPEN' && supabaseBreakerState !== 'OPEN';
      const statusCode = isReady ? 200 : 503;

      sendStandardSuccess(
        res,
        {
          ready: isReady,
          dependencies: {
            database: {
              status: dbReady ? 'up' : 'down',
              type: isLiveSupabaseConfigured ? 'live-supabase' : 'local-store',
              circuitBreaker: supabaseBreakerState,
              error: dbError
            },
            ai_provider: {
              status: geminiApiKeyPresent ? 'configured' : 'fallback-mode',
              circuitBreaker: geminiBreakerState
            }
          },
          timestamp: new Date().toISOString()
        },
        statusCode,
        { requestId }
      );
      return;
    }

    // System & Supabase Status
    if (url.pathname === '/api/status') {
      const isConfigured = isLiveSupabaseConfigured;
      sendStandardSuccess(
        res,
        {
          status: 'online',
          environment: env.NODE_ENV,
          supabase: {
            configured: isConfigured,
            url: env.SUPABASE_URL
          },
          endpoints: [
            'GET    /health',
            'GET    /ready',
            'GET    /api/status',
            'POST   /api/auth/signup',
            'POST   /api/auth/login',
            'POST   /api/auth/logout (protected)',
            'GET    /api/auth/me (protected)',
            'GET    /api/subjects (protected)',
            'POST   /api/subjects (protected)',
            'GET    /api/subjects/:id (protected)',
            'PATCH  /api/subjects/:id (protected, optimistic concurrency)',
            'DELETE /api/subjects/:id (protected)',
            'GET    /api/units (protected)',
            'POST   /api/units (protected)',
            'GET    /api/units/:id (protected)',
            'PATCH  /api/units/:id (protected)',
            'DELETE /api/units/:id (protected)',
            'GET    /api/topics (protected)',
            'POST   /api/topics (protected)',
            'GET    /api/topics/:id (protected)',
            'PATCH  /api/topics/:id (protected)',
            'DELETE /api/topics/:id (protected)',
            'GET    /api/tasks (protected)',
            'POST   /api/tasks (protected)',
            'GET    /api/tasks/:id (protected)',
            'PATCH  /api/tasks/:id (protected)',
            'DELETE /api/tasks/:id (protected)',
            'GET    /api/exams (protected)',
            'POST   /api/exams (protected)',
            'GET    /api/exams/:id (protected)',
            'PATCH  /api/exams/:id (protected)',
            'DELETE /api/exams/:id (protected)',
            'GET    /api/materials (protected)',
            'POST   /api/materials (protected)',
            'GET    /api/materials/:id (protected)',
            'PATCH  /api/materials/:id (protected)',
            'DELETE /api/materials/:id (protected)',
            'GET    /api/readiness/:subjectId (protected)',
            'GET    /api/readiness (protected)',
            'GET    /api/risks/:subjectId (protected)',
            'GET    /api/risks (protected)',
            'GET    /api/planner/context (protected)',
            'GET    /api/planner/context/:subjectId (protected)',
            'POST   /api/rag/upload (protected, 202 async or 201 sync)',
            'GET    /api/rag/jobs/:jobId (protected)',
            'POST   /api/rag/search (protected)',
            'POST   /api/assistant/chat (protected)',
            'POST   /api/quiz/generate (protected)',
            'POST   /api/quiz/submit (protected, idempotent)'
          ],
          timestamp: new Date().toISOString()
        },
        200,
        { requestId }
      );
      return;
    }

    // 1. Auth Routes Dispatcher
    const authHandled = await handleAuthRoutes(req, res);
    if (authHandled) return;

    if (await handleActivityRoutes(req, res)) return;

    // 2. Core Domain CRUD Routes Dispatcher
    const domainHandled = await handleDomainRoutes(req, res);
    if (domainHandled) return;

    // 3. Academic Engine (Readiness & Risk) Routes Dispatcher
    const academicHandled = await handleAcademicRoutes(req, res);
    if (academicHandled) return;

    // 4. Adaptive Planner Unified Context Dispatcher
    const plannerHandled = await handlePlannerRoutes(req, res);
    if (plannerHandled) return;

    // 5. AI/RAG Routes Dispatcher (Phase 1 PDF Pipeline, Phase 2 Semantic Search, Async Jobs)
    const ragHandled = await handleRagRoutes(req, res);
    if (ragHandled) return;

    // 6. AI Study Assistant Dispatcher (Phase 3)
    const assistantHandled = await handleAssistantRoutes(req, res);
    if (assistantHandled) return;

    // 7. Quiz Generation & Scoring Dispatcher (Phase 4)
    const quizHandled = await handleQuizRoutes(req, res);
    if (quizHandled) return;

    // 404 Route Not Found
    sendStandardError(
      res,
      AppError.notFound(`Route ${req.method} ${url.pathname} not found`),
      requestId,
      { req, statusCodeOverride: 404 }
    );
  } catch (err: unknown) {
    if (!res.headersSent) {
      sendStandardError(
        res,
        err instanceof AppError ? err : AppError.internal(err instanceof Error ? err.message : 'Internal Server Error', err),
        requestId,
        { req }
      );
    }
  } finally {
    const latencyMs = Date.now() - startTime;
    logger.debug(`Request completed`, {
      requestId,
      method: req.method,
      path: req.url?.split('?')[0],
      latencyMs
    });
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️  Port ${PORT} is currently in use. Another backend server instance may already be running.`);
    console.warn(`   You can kill the existing process or run on another port by setting PORT=4001\n`);
  } else {
    console.error('Server error:', err);
  }
});

server.requestTimeout = 120000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
if (process.env.NODE_ENV !== 'test') {
  const shutdown = () => {
    logger.info('Shutdown requested');
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 15000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🌙 LunaLearn Backend running on http://localhost:${PORT}`);
    console.log(`   Health Check:     http://localhost:${PORT}/health`);
    console.log(`   Readiness Check:  http://localhost:${PORT}/ready`);
    console.log(`   API Status:       http://localhost:${PORT}/api/status`);
    console.log(`   Auth Routes:      http://localhost:${PORT}/api/auth/*`);
    console.log(`   Domain CRUD:      http://localhost:${PORT}/api/{subjects,units,topics,tasks,exams,materials}`);
    console.log(`   Academic Engine:  http://localhost:${PORT}/api/{readiness,risks}`);
    console.log('====================================================');
  });
}
