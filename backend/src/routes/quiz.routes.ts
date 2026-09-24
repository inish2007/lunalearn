import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSuccess, sendError } from '../routes/domain.routes.js';
import { QuizService } from '../services/quiz.service.js';
import { GenerateQuizSchema, SubmitQuizSchema } from '../types/quiz.js';

/**
 * Parses JSON request bodies with payload size limits.
 */
function parseJson<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk.toString();
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error('Payload exceeds maximum allowed size of 10MB.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error('Malformed JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

// ==============================================================================
// Quiz Generation & Scoring Routes Dispatcher (Phase 4)
// ==============================================================================

export async function handleQuizRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Match supported paths
  const isGenerate = pathname === '/api/quiz/generate' || pathname === '/api/rag/quiz/generate';
  const isSubmit = pathname === '/api/quiz/submit' || pathname === '/api/rag/quiz/submit';

  if (!isGenerate && !isSubmit) {
    return false;
  }

  if (method !== 'POST') {
    sendError(res, 'MethodNotAllowed', `Method ${method} not supported on ${pathname}. Use POST.`, 405);
    return true;
  }

  // 1. POST /api/quiz/generate
  if (isGenerate) {
    const handler = requireAuth(async (req, res, ctx) => {
      try {
        const body = await parseJson(req);
        const parsed = GenerateQuizSchema.safeParse(body);

        if (!parsed.success) {
          return sendError(
            res,
            'ValidationError',
            'Invalid quiz generation payload',
            400,
            parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
          );
        }

        const quizData = await QuizService.generateQuiz(
          ctx.db,
          ctx.user.id,
          parsed.data
        );

        return sendSuccess(
          res,
          quizData,
          200,
          'Quiz generated successfully'
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error generating quiz';
        const isNotFound = message.includes('not found');
        return sendError(
          res,
          isNotFound ? 'NotFound' : 'QuizGenerationError',
          message,
          isNotFound ? 404 : 500
        );
      }
    });

    await handler(req, res);
    return true;
  }

  // 2. POST /api/quiz/submit
  if (isSubmit) {
    const handler = requireAuth(async (req, res, ctx) => {
      try {
        const body = await parseJson(req);
        const parsed = SubmitQuizSchema.safeParse(body);

        if (!parsed.success) {
          return sendError(
            res,
            'ValidationError',
            'Invalid quiz submission payload',
            400,
            parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
          );
        }

        const submissionResult = await QuizService.scoreAndSubmitQuiz(
          ctx.db,
          ctx.user.id,
          parsed.data
        );

        return sendSuccess(
          res,
          submissionResult,
          201,
          'Quiz submitted and scored successfully'
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error submitting quiz';
        const isNotFound = message.includes('not found');
        return sendError(
          res,
          isNotFound ? 'NotFound' : 'QuizSubmissionError',
          message,
          isNotFound ? 404 : 500
        );
      }
    });

    await handler(req, res);
    return true;
  }

  return false;
}
