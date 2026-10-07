'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAcademic } from '@/lib/context/AcademicContext';
import { Card, PageHeader } from './Ui';
import { StudyActivity } from './StudyActivity';

export function PlannerView(){
 const {plannerContext,subjects}=useAcademic();
 const plan=plannerContext?.study_plan;
 const [subjectFilter,setSubjectFilter]=useState('');
 useEffect(()=>{
  const s = new URLSearchParams(window.location.search).get('subject');
  if(s) setSubjectFilter(s);
 },[]);

 const scopedSubject = subjects.find(s=>s.id===subjectFilter);
 const displayBlocks = plan?.blocks ? (subjectFilter ? plan.blocks.filter(b=>b.subject_id===subjectFilter) : plan.blocks) : [];

 return <>
  <PageHeader title="Your study planner" description="A shared time budget for deadlines, weak topics and unfinished work. Manage the syllabus in My Learning."/>
  <div className="mb-5 flex flex-wrap gap-4 text-sm text-primary">
   <Link href="/learning">Edit topic estimates</Link>
   <Link href="/tasks">Edit task estimates</Link>
   <Link href="/settings">Change availability</Link>
  </div>
  {scopedSubject && (
   <div className="mb-4 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-2 text-sm text-primary">
    <span>Scoped to: <strong>{scopedSubject.name}</strong></span>
    <button className="underline font-semibold" onClick={()=>{setSubjectFilter('');history.replaceState(null,'',location.pathname);}}>Show all subjects</button>
   </div>
  )}
  <Card>
   <h2 className="font-bold">Scheduled study blocks</h2>
   <p className="my-2 text-sm text-muted">Focus: {plannerContext?.student.study_time_settings.focus_start}–{plannerContext?.student.study_time_settings.focus_end} · {plannerContext?.student.study_time_settings.timezone || 'UTC'} · {plannerContext?.student.study_time_settings.available_hours_per_day ?? 2} hours/day</p>
   {!plan?<p>Schedule unavailable.</p>:plan.status!=='ready'?<div role="alert"><h3 className="font-bold">{plan.status==='insufficient_data'?'Add estimates to build your schedule':'This workload does not fit your available time'}</h3><ul className="mt-2 list-disc pl-5 text-sm">{plan.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>:displayBlocks.length===0?<p>{subjectFilter ? `No scheduled blocks for ${scopedSubject?.name || 'this subject'} in the current focus window.` : 'No study blocks fit the remaining focus windows, or all estimated work is complete. Check availability and remaining estimates.'}</p>:<><p className="text-sm text-muted">{plan.required_hours.toFixed(1)}h estimated work · {plan.available_hours.toFixed(1)}h available across the next eight calendar days.</p><div className="mt-4 space-y-3">{displayBlocks.map(b=><div key={b.id} className="rounded-xl border border-highlight/40 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{b.title}</h3><span className="text-sm">{b.minutes} min</span></div><p className="text-sm text-muted">{new Date(b.start).toLocaleString()} – {new Date(b.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · {subjects.find(s=>s.id===b.subject_id)?.name || 'General task'}</p><p className="mt-1 text-xs text-muted">{b.reason} · Planned, not completed</p><div className="mt-2 flex gap-4 text-sm text-primary"><Link href={b.task_id?`/tasks#${b.task_id}`:`/assistant?subject=${b.subject_id}`}>{b.task_id?'Open task':'Start studying'}</Link><a href="#study-activity">Log completed activity</a></div></div>)}</div></>}
  </Card>
  <div className="mt-5"><StudyActivity/></div>
 </>;
}
