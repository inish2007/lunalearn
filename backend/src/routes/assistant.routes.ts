import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { StudyAssistantService } from '../services/study-assistant.service.js';
import { AssistantChatSchema } from '../types/assistant.js';
import { AppError } from '../types/errors.js';
import { sendStandardSuccess, sendStandardError, getOrCreateRequestId } from '../lib/response.js';

/**
 * Parses JSON request bodies with payload limits.
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
// AI Study Assistant Routes Dispatcher
// ==============================================================================

export async function handleAssistantRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();
  const requestId = getOrCreateRequestId(req);

  // Match:
  // POST /api/assistant/chat
  // POST /api/assistant/ask
  // POST /api/rag/assistant
  const isAssistantRoute =
    pathname === '/api/assistant/chat' ||
    pathname === '/api/assistant/ask' ||
    pathname === '/api/rag/assistant';

  if (!isAssistantRoute) {
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

  const handler = requireAuth(async (req, res, ctx) => {
    try {
      const body = await parseJson(req);
      const parsed = AssistantChatSchema.safeParse(body);

      if (!parsed.success) {
        return sendStandardError(
          res,
          AppError.validation(
            'Invalid assistant chat payload',
            parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
          ),
          requestId,
          { req }
        );
      }

      const response = await StudyAssistantService.askAssistant(
        ctx.db,
        ctx.user.id,
        parsed.data
      );

      return sendStandardSuccess(
        res,
        response,
        200,
        {
          message: 'Assistant response generated successfully',
          requestId
        }
      );
    } catch (err: unknown) {
      if (err instanceof AppError) {
        return sendStandardError(res, err, requestId, { req });
      }
      const message = err instanceof Error ? err.message : 'Error in AI Study Assistant';
      return sendStandardError(res, AppError.aiError(message), requestId, { req });
    }
  });

  await handler(req, res);
  return true;
}
