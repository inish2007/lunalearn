import { ScheduleService } from './schedule.service.js';
import { z } from 'zod';
import { AcademicEngineService as Engine } from './academic-engine.service.js';
import { PlannerContextService } from './planner-context.service.js';
import { AppError } from '../types/errors.js';
export const SimulationSchema=z.object({subject_id:z.string().uuid(),additional_minutes:z.number().int().min(0).max(1440),completed_topic_ids:z.array(z.string().uuid()).max(200).default([]),available_hours_per_day:z.number().min(0).max(24).optional()});
export class SimulationService {
 static async simulate(db:any,userId:string,input:z.infer<typeof SimulationSchema>) {
  const context=await PlannerContextService.getPlannerContext(db,userId);
  const subject=context.subjects.find(s=>s.subject_id===input.subject_id);
  if(!subject)throw AppError.notFound('Subject not found');
  const baseline=await Engine.getSubjectReadiness(db,input.subject_id);
  const units=await db.from('units').select('id').eq('subject_id',input.subject_id);
  const topics=await db.from('topics').select('*').in('unit_id',(units.data || []).map((u:any)=>u.id));
  if(units.error || topics.error)throw AppError.internal('Could not load scenario topics');
  if(input.completed_topic_ids.some(id=>!(topics.data || []).some((t:any)=>t.id===id)))throw AppError.validation('Scenario topics must belong to the selected subject');
  const hypothetical=(topics.data || []).map((t:any)=>input.completed_topic_ids.includes(t.id)?{...t,status:'completed'}:t);
  const breakdown={...baseline.breakdown,topic_completion:Engine.calculateTopicCompletion(hypothetical),revision_activity:Engine.calculateRevisionActivity([{duration_minutes:(baseline.basis?.revision.minutes || 0)+input.additional_minutes,session_type:'focus'}])};
  if(input.available_hours_per_day!==undefined)context.student.study_time_settings.available_hours_per_day=input.available_hours_per_day;
  subject.weak_and_unfinished_topics=subject.weak_and_unfinished_topics.filter(t=>!input.completed_topic_ids.includes(t.id) || t.is_weak);
  const sessions=await db.from('study_sessions').select('*');
  if(sessions.error)throw AppError.internal('Could not load sessions');
  // Additional study consumes capacity today; it is not a free readiness gain.
  const now=new Date();
  const projectedSessions=[...(sessions.data || [])];
  if(input.additional_minutes>0)projectedSessions.push({subject_id:input.subject_id,started_at:now.toISOString(),duration_minutes:input.additional_minutes,session_type:'focus'});
  context.study_plan=ScheduleService.build(context,projectedSessions,now);
  let feasible=true,reason='The scenario fits the current feasibility rules.';
  try {PlannerContextService.assertPlanFeasible(context);}catch(e){feasible=false;reason=e instanceof Error?e.message:'Insufficient data';}
  const required=context.study_plan.status==='insufficient_data'?null:context.study_plan.required_hours;
  const available=context.study_plan.available_hours;
  const projected=Engine.calculateWeightedReadiness(breakdown);
  return {baseline:baseline.readiness_percentage,projected,delta:projected-baseline.readiness_percentage,baseline_breakdown:baseline.breakdown,projected_breakdown:breakdown,required_hours:required,available_hours:available,feasible,reason,assumptions:['Hypothetical activity only; nothing saved. Additional minutes consume today’s availability.','Quiz scores and assignment completion remain unchanged.','Revision is capped at 120 minutes in the rolling seven-day window.','Completing a topic does not clear its weak marker.']};
 }
}
