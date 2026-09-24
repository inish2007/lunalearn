import http from 'http';
import { AuthService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { SignInSchema, SignUpSchema } from '../types/auth.js';

export async function parseJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      // Guard against huge payload attacks (> 1MB)
      if (body.length > 1048576) {
        reject(new Error('Payload too large'));
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
        reject(new Error(message));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleAuthRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method?.toUpperCase();

  // POST /api/auth/signup
  if (url.pathname === '/api/auth/signup' && method === 'POST') {
    try {
      const rawBody = await parseJsonBody(req);
      const parsed = SignUpSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        });
        return true;
      }

      const result = await AuthService.signUp(parsed.data);
      sendJson(res, 201, {
        message: 'Account created successfully',
        ...result
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      sendJson(res, 400, { error: 'Registration error', message });
    }
    return true;
  }

  // POST /api/auth/login
  if (url.pathname === '/api/auth/login' && method === 'POST') {
    try {
      const rawBody = await parseJsonBody(req);
      const parsed = SignInSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        });
        return true;
      }

      const result = await AuthService.signIn(parsed.data);
      sendJson(res, 200, {
        message: 'Login successful',
        ...result
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      sendJson(res, 401, { error: 'Authentication error', message });
    }
    return true;
  }

  // POST /api/auth/logout (Protected)
  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    const protectedLogout = requireAuth(async (_req, res, ctx) => {
      try {
        await AuthService.signOut(ctx.token);
        sendJson(res, 200, { message: 'Logged out successfully' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Logout error';
        sendJson(res, 500, { error: 'Sign out failed', message });
      }
    });

    await protectedLogout(req, res);
    return true;
  }

  // GET /api/auth/me (Protected)
  if (url.pathname === '/api/auth/me' && method === 'GET') {
    const protectedMe = requireAuth(async (_req, res, ctx) => {
      sendJson(res, 200, {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          created_at: ctx.user.created_at,
          role: ctx.user.role
        },
        profile: ctx.profile
      });
    });

    await protectedMe(req, res);
    return true;
  }

  return false;
}
