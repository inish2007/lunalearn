import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { Database } from '../types/database.js';

/**
 * Public Supabase client using Anon Key.
 * Suitable for user-scoped authenticated queries subject to Row-Level Security.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Elevated Supabase Admin client using Service Role Key.
 * Bypasses RLS for administrative tasks, background sync, and system workers.
 * NEVER expose this or send to browser/frontend client.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
