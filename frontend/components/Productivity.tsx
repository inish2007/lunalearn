'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api, ClientAppError } from '@/lib/api';
import { useAcademic } from '@/lib/context/AcademicContext';
import { examCountdown, toLocalInput } from '@/lib/dates';
import { Card, PageHeader } from './Ui';
import { ReadinessDetails } from './ReadinessDetails';
import type { Task, Exam } from '@/lib/types/academic';
const inputClass='block w-full rounded-xl border border-highlight bg-card p-2 text-ink';
const button='rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50';

export function Productivity({kind}:{kind:'tasks'|'exams'}) {
 const {subjects,tasks,exams,readinessMap,plannerContext,refreshAll}=useAcademic();
 const [query,setQuery]=useState(''),[subject,setSubject]=useState(''),[view,setView]=useState('Upcoming'),[priority,setPriority]=useState(''),[type,setType]=useState(''),[sort,setSort]=useState('date');
 const [editing,setEditing]=useState<Task|Exam|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),creationId=useRef(''),dialog=useRef<HTMLDialogElement>(null);
 const [conflict,setConflict]=useState(false);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 const [estimate,setEstimate]=useState('');
 const [title,setTitle]=useState(''),[formSubject,setFormSubject]=useState(''),[date,setDate]=useState(''),[formPriority,setFormPriority]=useState('Medium'),[formType,setFormType]=useState('Task'),[target,setTarget]=useState(80);
 useEffect(()=>{setSubject(new URLSearchParams(location.search).get('subject') || '');},[]);
 const now=Date.now();
 function show(item?:Task|Exam) { creationId.current=crypto.randomUUID();setConflict(false); setEditing(item || null);setTitle(item?.title || '');setFormSubject(item?.subject_id || subjects[0]?.id || '');setDate(item ? ('exam_date' in item ? toLocalInput(item.exam_date) : item.due_date ? toLocalInput(item.due_date):'') : '');setFormPriority(item && 'priority' in item?item.priority:'Medium');setFormType(item && 'type' in item?item.type:'Task');setTarget(item && 'target_score' in item?item.target_score:80);setEstimate(item && 'estimated_minutes' in item ? item.estimated_minutes?.toString() || '' : '');setError('');setOpen(true); }
 async function mutate(action:()=>Promise<unknown>) {
  if(pending.current)return false;
  pending.current=true;setBusy(true);setError('');
  try{await action();await refreshAll();return true;}
  catch(e){const stale=e instanceof ClientAppError && e.status===409;setConflict(stale);setError(stale?'This record changed in another tab. Reload the latest version before editing again.':e instanceof Error?e.message:'Could not save.');if(stale)await refreshAll();return false;}
  finally{pending.current=false;setBusy(false);}
 }
 async function reloadRecord(){if(!editing)return;await mutate(async()=>{const latest=kind==='tasks'?await api.tasks.get(editing.id):await api.exams.get(editing.id);show(latest);});}
 async function save(e:React.FormEvent) {
  e.preventDefault();
  const ok=await mutate(async()=>{
   if(kind==='tasks') {const payload={title:title.trim(),estimated_minutes:estimate?Number(estimate):null,subject_id:formSubject || null,priority:formPriority,type:formType,due_date:date?new Date(date).toISOString():null};if(editing) await api.tasks.update(editing.id,payload,editing.updated_at);else await api.tasks.create({...payload,id:creationId.current});}
   else { const timestamp=new Date(date).toISOString(); if(editing && 'exam_date' in editing) await api.exams.update(editing.id,{title,target_score:target,...(timestamp!==editing.exam_date && toLocalInput(timestamp)!==toLocalInput(editing.exam_date)?{exam_date:timestamp}:{})},editing.updated_at);else await api.exams.create({id:creationId.current,title:title.trim(),subject_id:formSubject,exam_date:timestamp,target_score:target}); }
  });if(ok)setOpen(false);
 }
 const filtered=(kind==='tasks'?tasks:exams).filter(item=>{
  if(typeof location !== 'undefined' && location.hash === `#${item.id}`) return true;
  if(!item.title.toLowerCase().includes(query.toLowerCase()) || subject && item.subject_id!==subject)return false;
  if('exam_date' in item)return view==='History'?Date.parse(item.exam_date)<now:Date.parse(item.exam_date)>=now;
  if(priority && item.priority!==priority || type && item.type!==type)return false;
  if(view==='Completed')return item.is_completed;
  if(item.is_completed)return false;
  if(view==='Overdue')return !!item.due_date && Date.parse(item.due_date)<now;
  if(view==='Today')return !!item.due_date && new Date(item.due_date).toDateString()===new Date().toDateString();
  return !item.due_date || Date.parse(item.due_date)>=now;
 }).sort((a,b)=>{
  if(sort==='priority' && 'priority' in a && 'priority' in b){const ranks={High:0,Medium:1,Low:2};return ranks[a.priority]-ranks[b.priority];}
  const da='exam_date' in a?a.exam_date:a.due_date,db='exam_date' in b?b.exam_date:b.due_date;
  return (da?Date.parse(da):Infinity)-(db?Date.parse(db):Infinity);
 });
 return <>
  <PageHeader title={kind==='tasks'?'Tasks & assignments':'Exams & readiness'} description={kind==='tasks'?'Plan deadlines, priorities and completed work.':'Prepare for upcoming exams and keep past exams in history.'} action={<button disabled={busy} className={button} onClick={()=>show()}>Add {kind==='tasks'?'task':'exam'}</button>}/>
  <div className="mb-5 flex flex-wrap gap-3">
   <input aria-label="Search titles" placeholder="Search titles" className="rounded-xl border bg-card p-2" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="Subject filter" className="rounded-xl border bg-card p-2" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
   <select aria-label="View" className="rounded-xl border bg-card p-2" value={view} onChange={e=>setView(e.target.value)}>{(kind==='tasks'?['Today','Upcoming','Overdue','Completed']:['Upcoming','History']).map(v=><option key={v}>{v}</option>)}</select>
   {kind==='tasks' && <><select aria-label="Priority filter" className="rounded-xl border bg-card p-2" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option>{['High','Medium','Low'].map(v=><option key={v}>{v}</option>)}</select><select aria-label="Type filter" className="rounded-xl border bg-card p-2" value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{['Task','Assignment','Revision'].map(v=><option key={v}>{v}</option>)}</select><select aria-label="Sort" className="rounded-xl border bg-card p-2" value={sort} onChange={e=>setSort(e.target.value)}><option value="date">Due date</option><option value="priority">Priority</option></select></>}
   <button className="text-sm text-primary" onClick={()=>{setQuery('');setSubject('');setPriority('');setType('');setView('Upcoming');setSort('date');history.replaceState(null,'',location.pathname);}}>Clear filters</button>
  </div>
  {error && !open && <p role="alert" className="mb-4 text-red-600">{error}</p>}
  <div className="space-y-4">{filtered.length===0?<Card>No matching {kind}. Adjust filters or add one.</Card>:filtered.map(item=><Card key={item.id}>
   <div id={item.id} className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 break-words"><h2 className="font-bold [overflow-wrap:anywhere]">{item.title}</h2><p className="text-sm text-muted">{subjects.find(s=>s.id===item.subject_id)?.name || 'General task'} · {'exam_date' in item?examCountdown(item.exam_date):`${item.type} · ${item.priority}`}</p><p className="text-xs text-muted">{'exam_date' in item?new Date(item.exam_date).toLocaleString():item.due_date?new Date(item.due_date).toLocaleString():'No deadline'}</p></div><div className="flex gap-3 text-sm text-primary">{'is_completed' in item && <button disabled={busy} onClick={()=>void mutate(()=>api.tasks.update(item.id,{is_completed:!item.is_completed},item.updated_at))}>{item.is_completed?'Reopen':'Complete'}</button>}<button disabled={busy} onClick={()=>show(item)}>Edit</button><button disabled={busy} onClick={()=>{if(confirm(`Delete ${item.title}?`))void mutate(()=>kind==='tasks'?api.tasks.delete(item.id):api.exams.delete(item.id));}}>Delete</button></div></div>
   {'exam_date' in item && <div className="mt-4 space-y-3"><p className="text-sm">Target score goal: {item.target_score}% · Subject readiness: {readinessMap[item.subject_id]?.readiness_percentage ?? 'Unavailable'}{readinessMap[item.subject_id]?'%':''}</p><ReadinessDetails readiness={readinessMap[item.subject_id]}/><details><summary className="text-sm font-bold">Preparation checklist</summary><ul className="mt-2 list-disc pl-5 text-sm">{(plannerContext?.subjects.find(s=>s.subject_id===item.subject_id)?.weak_and_unfinished_topics || []).map(t=><li key={t.id}>{t.title} — {t.is_weak?'needs practice':t.status.replace('_',' ')}</li>)}</ul><p className="text-xs text-muted">Completion is recorded in My Learning after studying.</p></details><div className="flex flex-wrap gap-4 text-sm text-primary">{[['learning','Review topics'],['planner','Plan study'],['materials','Open materials'],['quizzes','Practice quiz']].map(([route,label])=><Link key={route} href={`/${route}?subject=${item.subject_id}`}>{label}</Link>)}</div></div>}
  </Card>)}</div>
  <dialog ref={dialog} onCancel={e=>{if(pending.current)e.preventDefault();else setOpen(false);}} aria-modal="true" aria-label={`${editing?'Edit':'Add'} ${kind}`} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-card p-0 backdrop:bg-black/50"><form onSubmit={save} className="w-full max-w-lg space-y-3 rounded-3xl bg-card p-6"><fieldset disabled={busy} className="space-y-3"><h2 className="text-xl font-bold">{editing?'Edit':'Add'} {kind==='tasks'?'task':'exam'}</h2><label className="block text-sm">Title<input autoFocus required pattern=".*\S.*" maxLength={kind==='tasks'?250:200} value={title} onChange={e=>setTitle(e.target.value)} className={inputClass}/></label><label className="block text-sm">Subject<select required={kind==='exams'} disabled={kind==='exams' && !!editing} value={formSubject} onChange={e=>setFormSubject(e.target.value)} className={inputClass}><option value="">General / choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block text-sm">{kind==='tasks'?'Deadline (optional; clear to remove)':'Exam date and time'}<input required={kind==='exams'} type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className={inputClass}/></label>{kind==='tasks'?<><label className="block text-sm">Remaining work (minutes)<input type="number" min="1" max="10080" value={estimate} onChange={e=>setEstimate(e.target.value)} className={inputClass}/></label><label className="block text-sm">Priority<select value={formPriority} onChange={e=>setFormPriority(e.target.value)} className={inputClass}>{['High','Medium','Low'].map(v=><option key={v}>{v}</option>)}</select></label><label className="block text-sm">Type<select value={formType} onChange={e=>setFormType(e.target.value)} className={inputClass}>{['Task','Assignment','Revision'].map(v=><option key={v}>{v}</option>)}</select></label></>:<label className="block text-sm">Target score goal (%)<input type="number" min="0" max="100" value={target} onChange={e=>setTarget(Number(e.target.value))} className={inputClass}/></label>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}{conflict && editing && <button type="button" className="text-primary underline" onClick={()=>void reloadRecord()}>Reload latest version (discards edits)</button>}<div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button disabled={busy || conflict} className={button}>{busy?'Saving…':'Save'}</button></div></fieldset></form></dialog>
 </>;
}
