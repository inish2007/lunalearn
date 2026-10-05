import { z } from 'zod';
import { Profile } from './database.js';

export const SignUpSchema = z.object({
  email: z.string().email({ message: 'A valid email is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }).optional(),
  course: z.string().default('B.Tech'),
  semester: z.number().int().min(1).max(12).default(4),
  avatar_url: z.string().url().optional()
});

export type SignUpInput = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: z.string().email({ message: 'A valid email is required' }),
  password: z.string().min(1, { message: 'Password is required' })
});

export type SignInInput = z.infer<typeof SignInSchema>;

export const UpdateProfileSettingsSchema = z.object({
  available_hours_per_day: z.number().min(0).max(24).nullable()
}).strict();

export type UpdateProfileSettingsInput = z.infer<typeof UpdateProfileSettingsSchema>;

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  role?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResult {
  user: AuthUser;
  session: AuthSession | null;
  profile: Profile | null;
}
