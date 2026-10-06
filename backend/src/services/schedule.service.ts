import { PlannerContextResponse, StudySession } from '../types/database.js';
export interface StudyBlock {id:string;subject_id:string|null;topic_id?:string;task_id?:string;title:string;reason:string;start:string;end:string;minutes:number}
export interface StudyPlan {status:'ready'|'insufficient_data'|'constraint_conflict';blocks:StudyBlock[];issues:string[];required_hours:number;available_hours:number;generated_at:string}
export function localDate(value:Date,timezone:string):string {return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
export function zonedInstant(day:string,time:string,timezone:string):number {
 const desired=Date.parse(`${day}T${time}:00Z`);let guess=desired;
 for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));const actual=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);guess+=desired-actual;}
 return guess;
}
export class ScheduleService {
 static build(context:PlannerContextResponse,sessions:StudySession[]=[],now=new Date()):StudyPlan {
  sessions=sessions.filter(s=>Number.isFinite(Date.parse(s.started_at)) && Number.isFinite(s.duration_minutes) && s.duration_minutes>=0 && Date.parse(s.started_at)<=now.getTime());
  const settings=context.student.study_time_settings,tz=settings.timezone || 'UTC',today=localDate(now,tz);
  const windows:Array<{start:number;end:number}>=[];
  for(let d=0;d<8;d++){
   const day=new Date(Date.parse(today+'T12:00:00Z')+d*86400000).toISOString().slice(0,10);
   const focusStart=zonedInstant(day,settings.focus_start || '17:00',tz),focusEnd=zonedInstant(day,settings.focus_end || '19:00',tz);
   const logged=sessions.filter(s=>localDate(new Date(s.started_at),tz)===day).reduce((n,s)=>n+s.duration_minutes,0);
   const budget=Math.max(0,settings.available_hours_per_day*60-logged)*60000;
   const start=Math.max(Math.ceil(now.getTime()/60000)*60000,focusStart),end=Math.min(focusEnd,start+budget);
   if(end>start)windows.push({start,end});
  }
  type Work={id:string;subject_id:string|null;topic_id?:string;task_id?:string;title:string;reason:string;minutes:number|null;deadline:number;rank:number};
  const work:Work[]=[];
  for(const subject of context.subjects){
   const deadline=subject.exams.length?Math.min(...subject.exams.map(e=>Date.parse(e.exam_date))):Infinity;
   for(const t of subject.weak_and_unfinished_topics){
    const logged=sessions.filter(s=>s.topic_id===t.id && localDate(new Date(s.started_at),tz)===today).reduce((n,s)=>n+s.duration_minutes,0);
    work.push({id:t.id,subject_id:subject.subject_id,topic_id:t.id,title:t.title,reason:t.is_weak?'Weak topic needs practice':'Unfinished syllabus topic',minutes:t.estimated_study_hours==null?null:Math.max(0,t.estimated_study_hours*60-logged),deadline,rank:t.is_weak?1:2});
   }
  }
  const tasks=[...context.subjects.flatMap(s=>s.pending_tasks.map(t=>({...t,subject_id:s.subject_id}))),...context.unassigned_pending_tasks.map(t=>({...t,subject_id:null}))];
  for(const t of tasks)work.push({id:t.id,subject_id:t.subject_id,task_id:t.id,title:t.title,reason:`${t.priority} priority ${t.type.toLowerCase()}`,minutes:t.estimated_minutes ?? null,deadline:t.due_date?Date.parse(t.due_date):Infinity,rank:t.priority==='High'?0:t.priority==='Medium'?2:3});
  work.sort((a,b)=>a.deadline-b.deadline || a.rank-b.rank || a.id.localeCompare(b.id));
  const issues=work.filter(w=>w.minutes===null).map(w=>`Add a remaining-time estimate for ${w.title}.`);
  const available=windows.reduce((n,w)=>n+(w.end-w.start)/3600000,0),required=work.reduce((n,w)=>n+(w.minutes || 0)/60,0);
  let status:StudyPlan['status']=issues.length?'insufficient_data':'ready';
  const horizon=windows.at(-1)?.end || now.getTime()+7*86400000;
  for(const deadline of [...new Set(work.map(w=>w.deadline))].filter(d=>Number.isFinite(d)&&d<=horizon)){
   const demand=work.filter(w=>w.deadline<=deadline).reduce((n,w)=>n+(w.minutes || 0),0);
   const capacity=windows.reduce((n,w)=>n+Math.max(0,Math.min(w.end,deadline)-w.start)/60000,0);
   if(demand>capacity){issues.push(`${Math.round(demand)} minutes of work are due by ${new Date(deadline).toISOString()}, but only ${Math.floor(capacity)} minutes fit your shared focus windows.`);if(status==='ready')status='constraint_conflict';}
  }
  const blocks:StudyBlock[]=[];
  if(status==='ready'){
   let wi=0,cursor=windows[0]?.start || 0;
   for(const item of work){let remaining=item.minutes || 0;while(remaining>0 && wi<windows.length){const window=windows[wi];cursor=Math.max(cursor,window.start);const minutes=Math.min(50,remaining,Math.floor((window.end-cursor)/60000));if(minutes<=0){wi++;cursor=windows[wi]?.start || 0;continue;}const end=cursor+minutes*60000;blocks.push({id:`${item.id}:${cursor}`,subject_id:item.subject_id,topic_id:item.topic_id,task_id:item.task_id,title:item.title,reason:item.reason,start:new Date(cursor).toISOString(),end:new Date(end).toISOString(),minutes});remaining-=minutes;cursor=end;}}
  }
  return {status,blocks,issues,required_hours:required,available_hours:available,generated_at:now.toISOString()};
 }
}
