import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { Database } from '../types/database.js';
import { LocalDevStore } from './local-store.js';
import { isLiveSupabaseConfigured } from './supabase.js';

/**
 * Creates a user-scoped Supabase client bound to the authenticated user's JWT.
 * 
 * Every query, insert, update, or delete executed through this client will pass
 * the user's Bearer token directly to PostgreSQL via PostgREST, causing Postgres
 * to evaluate `auth.uid() = user.id`.
 * 
 * When Supabase is not configured or a local dev token is used, routes queries to
 * the reactive LocalDevStore with strict user-scoping simulation.
 */
export function createScopedClient(accessToken: string): SupabaseClient<Database> {
  const isLocalToken = accessToken.startsWith('local-dev-jwt-');
  const isProd = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';

  if (isProd && (isLocalToken || !isLiveSupabaseConfigured)) {
    throw new Error('FATAL: Local dev tokens and unconfigured Supabase are strictly prohibited in production.');
  }

  if (!isLiveSupabaseConfigured || isLocalToken) {
    const userId = isLocalToken ? accessToken.replace('local-dev-jwt-', '') : undefined;
    return LocalDevStore.getInstance().createClient(userId);
  }

  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

/**
 * Validates a Bearer token with Supabase Auth (or LocalDevStore) and returns the verified user.
 */
export async function verifyUserToken(accessToken: string): Promise<User> {
  const isLocalToken = accessToken.startsWith('local-dev-jwt-');
  const isProd = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';

  if (isProd && (isLocalToken || !isLiveSupabaseConfigured)) {
    throw new Error('FATAL: Local dev tokens are prohibited in production.');
  }

  if (!isLiveSupabaseConfigured || isLocalToken) {
    return LocalDevStore.getInstance().verifyToken(accessToken);
  }

  try {
    const client = createScopedClient(accessToken);
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      throw new Error(error?.message || 'Invalid or expired session token');
    }

    return data.user;
  } catch (err: unknown) {
    if (isProd) {
      throw err;
    }
    // Graceful offline/network fallback only in development/test
    console.warn(`⚠️ Live Supabase auth verification failed (${(err as Error).message}). Falling back to local verification.`);
    return LocalDevStore.getInstance().verifyToken(accessToken);
  }
}

