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
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT || '4000',
    NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development'
  };
}

export const env = getEnv();
