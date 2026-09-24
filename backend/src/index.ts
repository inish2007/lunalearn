import http from 'http';
import { env } from './config/env.js';
import { handleAuthRoutes } from './routes/auth.routes.js';
import { handleDomainRoutes } from './routes/domain.routes.js';
import { handleAcademicRoutes } from './routes/academic.routes.js';
import { handlePlannerRoutes } from './routes/planner.routes.js';
import { handleRagRoutes } from './routes/rag.routes.js';
import { handleAssistantRoutes } from './routes/assistant.routes.js';
import { handleQuizRoutes } from './routes/quiz.routes.js';

export * from './config/env.js';
export * from './lib/supabase.js';
export * from './lib/scoped-client.js';
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
export * from './services/embedding.service.js';
export * from './services/semantic-search.service.js';
export * from './services/study-assistant.service.js';
export * from './services/quiz.service.js';
export * from './middleware/auth.middleware.js';
export * from './routes/domain.routes.js';
export * from './routes/academic.routes.js';
export * from './routes/planner.routes.js';
export * from './routes/rag.routes.js';
export * from './routes/assistant.routes.js';
export * from './routes/quiz.routes.js';


const PORT = parseInt(env.PORT, 10);

export const server = http.createServer(async (req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Base Health Check
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'lunalearn-backend',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // System & Supabase Status
  if (url.pathname === '/api/status') {
    const isConfigured = !env.SUPABASE_URL.includes('your-project-ref') && !env.SUPABASE_URL.includes('placeholder');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      environment: env.NODE_ENV,
      supabase: {
        configured: isConfigured,
        url: env.SUPABASE_URL
      },
      endpoints: [
        'GET    /health',
        'GET    /api/status',
        'POST   /api/auth/signup',
        'POST   /api/auth/login',
        'POST   /api/auth/logout (protected)',
        'GET    /api/auth/me (protected)',
        'GET    /api/subjects (protected)',
        'POST   /api/subjects (protected)',
        'GET    /api/subjects/:id (protected)',
        'PATCH  /api/subjects/:id (protected)',
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
        'POST   /api/rag/upload (protected)',
        'POST   /api/rag/search (protected)',
        'POST   /api/assistant/chat (protected)',
        'POST   /api/quiz/generate (protected)',
        'POST   /api/quiz/submit (protected)'
      ],
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 1. Auth Routes Dispatcher
  const authHandled = await handleAuthRoutes(req, res);
  if (authHandled) return;

  // 2. Core Domain CRUD Routes Dispatcher
  const domainHandled = await handleDomainRoutes(req, res);
  if (domainHandled) return;

  // 3. Academic Engine (Readiness & Risk) Routes Dispatcher
  const academicHandled = await handleAcademicRoutes(req, res);
  if (academicHandled) return;

  // 4. Adaptive Planner Unified Context Dispatcher
  const plannerHandled = await handlePlannerRoutes(req, res);
  if (plannerHandled) return;

  // 5. AI/RAG Routes Dispatcher (Phase 1 PDF Pipeline & Materials Upload, Phase 2 Semantic Search)
  const ragHandled = await handleRagRoutes(req, res);
  if (ragHandled) return;

  // 6. AI Study Assistant Dispatcher (Phase 3)
  const assistantHandled = await handleAssistantRoutes(req, res);
  if (assistantHandled) return;

  // 7. Quiz Generation & Scoring Dispatcher (Phase 4)
  const quizHandled = await handleQuizRoutes(req, res);
  if (quizHandled) return;

  // 404 Route Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: 'NotFound',
    message: `Route ${req.method} ${url.pathname} not found`,
    availableResources: [
      '/api/auth',
      '/api/subjects',
      '/api/units',
      '/api/topics',
      '/api/tasks',
      '/api/exams',
      '/api/materials',
      '/api/readiness',
      '/api/risks',
      '/api/planner/context',
      '/api/rag/upload',
      '/api/rag/search',
      '/api/assistant/chat',
      '/api/quiz/generate',
      '/api/quiz/submit'
    ]
  }));

});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️  Port ${PORT} is currently in use. Another backend server instance may already be running.`);
    console.warn(`   You can kill the existing process or run on another port by setting PORT=4001\n`);
  } else {
    console.error('Server error:', err);
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🌙 LunaLearn Backend running on http://localhost:${PORT}`);
    console.log(`   Health Check:     http://localhost:${PORT}/health`);
    console.log(`   API Status:       http://localhost:${PORT}/api/status`);
    console.log(`   Auth Routes:      http://localhost:${PORT}/api/auth/*`);
    console.log(`   Domain CRUD:      http://localhost:${PORT}/api/{subjects,units,topics,tasks,exams,materials}`);
    console.log(`   Academic Engine:  http://localhost:${PORT}/api/{readiness,risks}`);
    console.log('====================================================');
  });
}
