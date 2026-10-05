import http from 'http';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { parseJsonBody } from './auth.routes.js';
import { AppError } from '../types/errors.js';
import { sendStandardError, sendStandardSuccess } from '../lib/response.js';

export const SessionSchema = z.object({
 id: z.string().uuid(), subject_id: z.string().uuid(), topic_id: z.string().uuid().nullable().optional(),
 session_type: z.enum(['focus','revision','quiz','task']), started_at: z.string().datetime(), ended_at: z.string().datetime(),
 notes: z.string().max(2000).optional(), timezone: z.string().max(100).default('UTC')
}).refine(s => Date.parse(s.ended_at) <= Date.now() && Date.parse(s.started_at) < Date.parse(s.ended_at) && Date.parse(s.ended_at)-Date.parse(s.started_at)>=60000, 'Use a completed session lasting at least one minute, with no future times.');

export async function handleActivityRoutes(req:http.IncomingMessage,res:http.ServerResponse):Promise<boolean> {
 const pathname=new URL(req.url || '/', 'http://localhost').pathname;
 if(!['/api/study-sessions','/api/activity'].includes(pathname)) return false;
 await requireAuth(async(req,res,ctx)=>{
  try {
   const db=ctx.db as any;
   if(pathname==='/api/study-sessions' && req.method==='POST') {
    const parsed=SessionSchema.safeParse(await parseJsonBody(req));
    if(!parsed.success) throw AppError.validation('Invalid study session',parsed.error.issues.map(i=>({field:i.path.join('.'),message:i.message})));
    try { new Intl.DateTimeFormat('en',{timeZone:parsed.data.timezone}).format(); } catch { throw AppError.validation('Invalid timezone'); }
    const result=await db.rpc('log_study_session',{p_session:parsed.data});
    if(result.error) throw AppError.validation(result.error.message || 'Session could not be logged');
    return sendStandardSuccess(res,result.data,201);
   }
   if(req.method!=='GET') throw AppError.validation('Unsupported method');
   const sessions=await db.from('study_sessions').select('*').order('started_at',{ascending:false});
   if(sessions.error) throw AppError.internal('Could not load sessions',sessions.error);
   if(pathname==='/api/study-sessions') return sendStandardSuccess(res,sessions.data || []);
   const events=await db.from('xp_events').select('*').order('created_at',{ascending:false});
   if(events.error) throw AppError.internal('Could not load XP. Apply activity migration.',events.error);
   const list=events.data || []; const xp=list.reduce((n:number,e:any)=>n+e.amount,0);
   return sendStandardSuccess(res,{xp,level:1+Math.floor(xp/500),progress_percent:(xp%500)/5,next_level_xp:500-xp%500,events:list,sessions:sessions.data || []});
  } catch(err) { return sendStandardError(res,err); }
 })(req,res);
 return true;
}
