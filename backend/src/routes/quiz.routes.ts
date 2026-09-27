import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { QuizService } from '../services/quiz.service.js';
import { GenerateQuizSchema, SubmitQuizSchema } from '../types/quiz.js';
import { AppError } from '../types/errors.js';
import { sendStandardSuccess, sendStandardError, getOrCreateRequestId } from '../lib/response.js';

/**
 * Parses JSON request bodies with payload size limits.
 */
function parseJson<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk.toString();
      if (raw.length > 10 * 1024 * 1024) {
        reject(AppError.payloadTooLarge('Payload exceeds maximum allowed size of 10MB.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(AppError.validation('Malformed JSON payload.'));
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
  const requestId = getOrCreateRequestId(req);

  // Match supported paths
  const isGenerate = pathname === '/api/quiz/generate' || pathname === '/api/rag/quiz/generate';
  const isSubmit = pathname === '/api/quiz/submit' || pathname === '/api/rag/quiz/submit';

  if (!isGenerate && !isSubmit) {
    return false;
  }

  if (method !== 'POST') {
    sendStandardError(
      res,
      AppError.validation(`Method ${method} not supported on ${pathname}. Use POST.`),
      requestId,
      { req, statusCodeOverride: 405 }
    );
    return true;
  }

  // 1. POST /api/quiz/generate
  if (isGenerate) {
    const handler = requireAuth(async (req, res, ctx) => {
      try {
        const body = await parseJson(req);
        const parsed = GenerateQuizSchema.safeParse(body);

        if (!parsed.success) {
          return sendStandardError(
            res,
            AppError.validation(
              'Invalid quiz generation payload',
              parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
            ),
            requestId,
            { req }
          );
        }

        const quizData = await QuizService.generateQuiz(
          ctx.db,
          ctx.user.id,
          parsed.data
        );

        return sendStandardSuccess(
          res,
          quizData,
          200,
          {
            message: 'Quiz generated successfully',
            requestId
          }
        );
      } catch (err: unknown) {
        if (err instanceof AppError) {
          return sendStandardError(res, err, requestId, { req });
        }
        const message = err instanceof Error ? err.message : 'Error generating quiz';
        const isNotFound = message.includes('not found');
        return sendStandardError(
          res,
          isNotFound ? AppError.notFound(message) : AppError.aiError(message),
          requestId,
          { req }
        );
      }
    });

    await handler(req, res);
    return true;
  }

  // 2. POST /api/quiz/submit (Supports Idempotency-Key)
  if (isSubmit) {
    const handler = requireAuth(async (req, res, ctx) => {
      try {
        const body = await parseJson(req);
        const parsed = SubmitQuizSchema.safeParse(body);

        if (!parsed.success) {
          return sendStandardError(
            res,
            AppError.validation(
              'Invalid quiz submission payload',
              parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
            ),
            requestId,
            { req }
          );
        }

        const idempotencyKey =
          (req.headers['idempotency-key'] as string) || parsed.data.idempotency_key;

        const submissionResult = await QuizService.scoreAndSubmitQuiz(
          ctx.db,
          ctx.user.id,
          {
            ...parsed.data,
            idempotency_key: idempotencyKey
          }
        );

        const responseHeaders: Record<string, string> = {};
        if (idempotencyKey) {
          responseHeaders['Idempotency-Key'] = idempotencyKey;
        }

        return sendStandardSuccess(
          res,
          submissionResult,
          201,
          {
            message: 'Quiz submitted and scored successfully',
            headers: responseHeaders,
            requestId
          }
        );
      } catch (err: unknown) {
        if (err instanceof AppError) {
          return sendStandardError(res, err, requestId, { req });
        }
        const message = err instanceof Error ? err.message : 'Error submitting quiz';
        const isNotFound = message.includes('not found');
        return sendStandardError(
          res,
          isNotFound ? AppError.notFound(message) : AppError.internal(message, err),
          requestId,
          { req }
        );
      }
    });

    await handler(req, res);
    return true;
  }

  return false;
}
