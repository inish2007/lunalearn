import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { Database } from '../types/database.js';

/**
 * Creates a user-scoped Supabase client bound to the authenticated user's JWT.
 * 
 * Every query, insert, update, or delete executed through this client will pass
 * the user's Bearer token directly to PostgreSQL via PostgREST, causing Postgres
 * to evaluate `auth.uid() = user.id`.
 * 
 * Under the Row-Level Security (RLS) policies configured in Phase 1:
 * - The authenticated user can ONLY view and mutate rows where profile_id == auth.uid().
 * - Cross-user data leaks or unauthorized modifications are physically rejected by the database.
 */
export function createScopedClient(accessToken: string): SupabaseClient<Database> {
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
 * Validates a Bearer token with Supabase Auth and returns the verified user.
 */
export async function verifyUserToken(accessToken: string): Promise<User> {
  // Use public client with passed accessToken to verify token integrity
  const client = createScopedClient(accessToken);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error(error?.message || 'Invalid or expired session token');
  }

  return data.user;
}
