import { env } from '../config/env.js';
import { supabase, supabaseAdmin } from '../lib/supabase.js';

async function testConnection() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — Backend & Supabase Diagnostic Test');
  console.log('====================================================\n');

  console.log('1. Checking Environment Variables:');
  console.log(`   - SUPABASE_URL: ${env.SUPABASE_URL}`);
  console.log(`   - SUPABASE_ANON_KEY: ${env.SUPABASE_ANON_KEY ? env.SUPABASE_ANON_KEY.substring(0, 15) + '...' : '(missing)'}`);
  console.log(`   - SUPABASE_SERVICE_ROLE_KEY: ${env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15) + '...' : '(missing)'}`);

  if (
    env.SUPABASE_URL.includes('your-project-ref') ||
    env.SUPABASE_URL.includes('placeholder') ||
    env.SUPABASE_ANON_KEY.includes('your-anon')
  ) {
    console.log('\n⚠️  Notice: Placeholder credentials detected in backend/.env.');
    console.log('   To test live queries against your cloud Supabase database:');
    console.log('   1. Open your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('   2. Navigate to Project Settings -> API');
    console.log('   3. Copy "Project URL", "anon public", and "service_role" keys');
    console.log('   4. Paste them into backend/.env\n');
    console.log('   To apply the schema migrations:');
    console.log('   - Paste supabase/migrations/20260922000001_phase1_initial_schema.sql into the Supabase SQL Editor.\n');
    return;
  }

  console.log('\n2. Testing Connection to Supabase REST / Auth...');
  try {
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.warn(`   ⚠️ Auth ping warning: ${authError.message}`);
    } else {
      console.log('   ✅ Supabase Auth service reachable.');
    }

    console.log('\n3. Testing Database Tables via Service Role Client...');
    const tables = ['profiles', 'subjects', 'units', 'topics', 'tasks', 'exams', 'materials', 'document_chunks', 'quiz_results', 'study_sessions'] as const;

    for (const table of tables) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ [${table}]: Table check returned error: ${error.message}`);
        console.log(`      (Make sure to run the migration in Supabase SQL Editor if you haven't yet)`);
      } else {
        console.log(`   ✅ [${table}]: Verified (record count: ${count ?? 0})`);
      }
    }

    console.log('\n✨ Supabase connection test complete.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Connection failed: ${message}`);
  }
}

testConnection().catch((err) => {
  console.error('Fatal error during connection test:', err);
  process.exit(1);
});
