import http from 'http';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSuccess, sendError } from '../routes/domain.routes.js';
import { StudyAssistantService } from '../services/study-assistant.service.js';
import { AssistantChatSchema } from '../types/assistant.js';

/**
 * Parses JSON request bodies with payload limits.
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
// AI Study Assistant Routes Dispatcher
// ==============================================================================

export async function handleAssistantRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

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
    sendError(res, 'MethodNotAllowed', `Method ${method} not supported on ${pathname}. Use POST.`, 405);
    return true;
  }

  const handler = requireAuth(async (req, res, ctx) => {
    try {
      const body = await parseJson(req);
      const parsed = AssistantChatSchema.safeParse(body);

      if (!parsed.success) {
        return sendError(
          res,
          'ValidationError',
          'Invalid assistant chat payload',
          400,
          parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
        );
      }

      const response = await StudyAssistantService.askAssistant(
        ctx.db,
        ctx.user.id,
        parsed.data
      );

      return sendSuccess(
        res,
        response,
        200,
        'Assistant response generated successfully'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error in AI Study Assistant';
      return sendError(res, 'AssistantError', message, 500);
    }
  });

  await handler(req, res);
  return true;
}
