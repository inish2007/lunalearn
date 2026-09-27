import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { Database } from '../types/database.js';
import { LocalDevStore } from './local-store.js';

export const isLiveSupabaseConfigured =
  Boolean(env.SUPABASE_URL) &&
  !env.SUPABASE_URL.includes('your-project-ref') &&
  !env.SUPABASE_URL.includes('placeholder');

if ((process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') && !isLiveSupabaseConfigured) {
  throw new Error('FATAL: Production mode requires a valid live Supabase configuration. Missing or placeholder SUPABASE_URL / keys.');
}

/**
 * Public Supabase client using Anon Key.
 * Suitable for user-scoped authenticated queries subject to Row-Level Security.
 * Falls back to LocalDevStore when unconfigured.
 */
export const supabase: SupabaseClient<Database> = isLiveSupabaseConfigured
  ? createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  : LocalDevStore.getInstance().createClient();

/**
 * Elevated Supabase Admin client using Service Role Key.
 * Bypasses RLS for administrative tasks, background sync, and system workers.
 * Falls back to LocalDevStore when unconfigured.
 */
export const supabaseAdmin: SupabaseClient<Database> = isLiveSupabaseConfigured
  ? createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  : LocalDevStore.getInstance().createClient();

