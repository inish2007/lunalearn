import http from 'http';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { createScopedClient, verifyUserToken } from '../lib/scoped-client.js';
import { Database, Profile } from '../types/database.js';

export interface AuthenticatedContext {
  user: User;
  token: string;
  db: SupabaseClient<Database>;
  profile: Profile | null;
}

export type AuthenticatedHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: AuthenticatedContext
) => Promise<void> | void;

/**
 * Protected Route Middleware
 * 
 * Sits in front of all private API endpoints.
 * 1. Validates the incoming Authorization: Bearer <token> header.
 * 2. Authenticates the token with Supabase Auth.
 * 3. Instantiates a user-scoped SupabaseClient (<Database>) bound to that token.
 * 4. Ensures all downstream database queries are strictly scoped to the authenticated user via RLS.
 */
export function requireAuth(handler: AuthenticatedHandler) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Please provide a valid Bearer token.'
      }));
      return;
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Empty Bearer token provided.'
      }));
      return;
    }

    let user: User;
    try {
      user = await verifyUserToken(token);
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or expired session' }));
      return;
    }
    {
      // 1. Verify token with Supabase Auth


      // 2. Instantiate scoped database client enforcing RLS in Postgres
      const db = createScopedClient(token);

      // 3. Fetch user profile safely
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw new Error('Profile could not be loaded');
      const context: AuthenticatedContext = {
        user,
        token,
        db,
        profile: profile || null
      };

      // 4. Pass execution to protected handler
      await handler(req, res, context);

    }
  };
}
