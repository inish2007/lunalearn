import { env } from './config/env.js';
import { supabase, supabaseAdmin } from './lib/supabase.js';

export * from './config/env.js';
export * from './lib/supabase.js';
export * from './types/database.js';

console.log('🌙 LunaLearn Backend Initialized.');
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`Supabase URL: ${env.SUPABASE_URL}`);
