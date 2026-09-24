import { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { createScopedClient } from '../lib/scoped-client.js';
import { AuthResult, SignInInput, SignUpInput } from '../types/auth.js';
import { Database, Profile } from '../types/database.js';

export class AuthService {
  /**
   * Registers a new student account and automatically synchronizes the matching profiles row.
   */
  static async signUp(input: SignUpInput): Promise<AuthResult> {
    const { email, password, full_name, course, semester, avatar_url } = input;

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || email.split('@')[0],
          course: course || 'B.Tech',
          semester: semester || 4,
          avatar_url
        }
      }
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Failed to register account');
    }

    const user = authData.user;
    const session = authData.session;

    // 2. Ensure matching profile exists in profiles table
    // The database trigger handles this, but we explicitly upsert with supabaseAdmin
    // to guarantee profile completeness immediately upon signup.
    const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      email: user.email || email,
      full_name: full_name || email.split('@')[0],
      avatar_url: avatar_url || null,
      course: course || 'B.Tech',
      semester: semester || 4,
      xp: 0,
      level: 1,
      preferred_focus_time: 'Evenings'
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload as any)
      .select('*')
      .single();

    if (profileError && !profile) {
      console.warn(`Profile upsert notice: ${profileError.message}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email || email,
        created_at: user.created_at,
        role: user.role
      },
      session: session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            token_type: session.token_type
          }
        : null,
      profile: profile || null
    };
  }

  /**
   * Authenticates user credentials with Supabase Auth and returns the session & profile.
   */
  static async signIn(input: SignInInput): Promise<AuthResult> {
    const { email, password } = input;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(authError?.message || 'Invalid email or password');
    }

    const user = authData.user;
    const session = authData.session;

    // Retrieve profile using the user-scoped client to verify RLS readability
    const scopedDb = createScopedClient(session.access_token);
    const { data: profile } = await scopedDb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      user: {
        id: user.id,
        email: user.email || email,
        created_at: user.created_at,
        role: user.role
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type
      },
      profile: profile || null
    };
  }

  /**
   * Signs the user out and invalidates the session.
   */
  static async signOut(accessToken: string): Promise<void> {
    const scopedClient = createScopedClient(accessToken);
    const { error } = await scopedClient.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Retrieves the authenticated user's profile using their scoped client.
   */
  static async getProfile(userId: string, scopedClient: SupabaseClient<Database>): Promise<Profile> {
    const { data, error } = await scopedClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Profile not found');
    }

    return data;
  }
}
