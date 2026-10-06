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
  available_hours_per_day: z.number().min(0).max(24).nullable().optional(),
  full_name: z.string().trim().min(2).max(120).optional(),
  course: z.string().trim().min(1).max(120).optional(), semester: z.number().int().min(1).max(12).optional(),
  focus_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  focus_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone').optional()
}).strict().refine(v=>Object.keys(v).length>0,'Provide a setting').refine(v=>(v.focus_start===undefined && v.focus_end===undefined) || (!!v.focus_start && !!v.focus_end && v.focus_start<v.focus_end),'Provide a same-day focus window with end after start.');

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
