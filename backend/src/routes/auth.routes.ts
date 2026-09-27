import http from 'http';
import { AuthService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { SignInSchema, SignUpSchema } from '../types/auth.js';
import { AppError } from '../types/errors.js';
import { sendStandardSuccess, sendStandardError, getOrCreateRequestId } from '../lib/response.js';

export async function parseJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      // Guard against huge payload attacks (> 1MB)
      if (body.length > 1048576) {
        reject(AppError.payloadTooLarge('Payload too large: request body exceeds 1MB'));
      }
    });
    req.on('end', () => {
      try {
        if (!body.trim()) {
          resolve({} as T);
          return;
        }
        resolve(JSON.parse(body) as T);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid JSON format';
        reject(AppError.validation(message));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export async function handleAuthRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method?.toUpperCase();
  const requestId = getOrCreateRequestId(req);

  // POST /api/auth/signup
  if (url.pathname === '/api/auth/signup' && method === 'POST') {
    try {
      const rawBody = await parseJsonBody(req);
      const parsed = SignUpSchema.safeParse(rawBody);

      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        sendStandardError(res, AppError.validation('Validation failed', issues), requestId, { req });
        return true;
      }

      const result = await AuthService.signUp(parsed.data);
      sendStandardSuccess(res, result, 201, {
        message: 'Account created successfully',
        requestId
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      const isConflict = msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate');
      const errorToThrow = isConflict ? AppError.conflict('An account with this email address already exists') : (err instanceof AppError ? err : AppError.validation(msg));
      sendStandardError(res, errorToThrow, requestId, { req });
    }
    return true;
  }

  // POST /api/auth/login
  if (url.pathname === '/api/auth/login' && method === 'POST') {
    try {
      const rawBody = await parseJsonBody(req);
      const parsed = SignInSchema.safeParse(rawBody);

      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        sendStandardError(res, AppError.validation('Validation failed', issues), requestId, { req });
        return true;
      }

      const result = await AuthService.signIn(parsed.data);
      sendStandardSuccess(res, result, 200, {
        message: 'Login successful',
        requestId
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      const errorToThrow = err instanceof AppError ? err : AppError.unauthorized(msg);
      sendStandardError(res, errorToThrow, requestId, { req });
    }
    return true;
  }

  // POST /api/auth/refresh
  if (url.pathname === '/api/auth/refresh' && method === 'POST') {
    try {
      const rawBody = await parseJsonBody<{ refresh_token?: string }>(req);
      const refreshToken = rawBody?.refresh_token;
      if (!refreshToken) {
        sendStandardError(res, AppError.validation('Missing required parameter: refresh_token'), requestId, { req });
        return true;
      }
      const result = await AuthService.refreshSession(refreshToken);
      sendStandardSuccess(res, result, 200, {
        message: 'Session refreshed successfully',
        requestId
      });
    } catch (err: unknown) {
      sendStandardError(res, err instanceof AppError ? err : AppError.unauthorized('Invalid or expired refresh token'), requestId, { req });
    }
    return true;
  }

  // POST /api/auth/logout (Protected)
  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    const protectedLogout = requireAuth(async (_req, res, ctx) => {
      try {
        await AuthService.signOut(ctx.token);
        sendStandardSuccess(res, { message: 'Logged out successfully' }, 200, {
          message: 'Logged out successfully',
          requestId
        });
      } catch (err: unknown) {
        sendStandardError(res, err instanceof AppError ? err : AppError.internal('Sign out failed', err), requestId, { req });
      }
    });

    await protectedLogout(req, res);
    return true;
  }

  // GET /api/auth/me (Protected)
  if (url.pathname === '/api/auth/me' && method === 'GET') {
    const protectedMe = requireAuth(async (_req, res, ctx) => {
      const meData = {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          created_at: ctx.user.created_at,
          role: ctx.user.role
        },
        profile: ctx.profile
      };
      sendStandardSuccess(res, meData, 200, {
        requestId
      });
    });

    await protectedMe(req, res);
    return true;
  }

  return false;
}
