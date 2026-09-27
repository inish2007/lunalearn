import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Resolve .env from either current directory or backend subdirectory
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env')
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL (e.g. https://xyz.supabase.co)' }),
  SUPABASE_ANON_KEY: z.string().min(10, { message: 'SUPABASE_ANON_KEY is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  DATABASE_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().optional(),
  PORT: z.string().regex(/^\d+$/).default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.warn('\n⚠️  Environment configuration warning:');
    for (const issue of result.error.issues) {
      console.warn(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.warn('   Please check backend/.env against backend/.env.example\n');
  }

  const nodeEnv = (process.env.NODE_ENV as Env['NODE_ENV']) || 'development';
  const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

  if (nodeEnv === 'production') {
    const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder') || supabaseUrl.includes('your-project-ref');
    if (isPlaceholder || !supabaseAnonKey || supabaseAnonKey.includes('placeholder') || !supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
      throw new Error('FATAL CONFIGURATION ERROR: NODE_ENV is set to production but live Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) are missing or set to placeholder.');
    }
  }
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/^['"]|['"]$/g, '').trim() : undefined,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL?.trim(),
    GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL?.trim(),
    PORT: process.env.PORT || '4000',
    NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development'
  };
}


export const env = getEnv();

