'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAcademic } from '@/lib/context/AcademicContext';

export function StudyActivity() {
 const { subjects, topics, units, refreshAll, plannerContext }=useAcademic();
 const [data,setData]=useState<Awaited<ReturnType<typeof api.activity.get>> | null>(null);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const [subject,setSubject]=useState(subjects[0]?.id || ''); const [topic,setTopic]=useState('');
 const [kind,setKind]=useState('focus'); const [start,setStart]=useState(''); const [end,setEnd]=useState(''); const [notes,setNotes]=useState('');
 const [requestId,setRequestId]=useState('');
 useEffect(()=>{ let active=true; api.activity.get().then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}); return()=>{active=false;}; },[plannerContext?.generated_at]);
 async function save(e:React.FormEvent) {
  e.preventDefault();setBusy(true);setError('');
  const id=requestId || crypto.randomUUID();setRequestId(id);
  try {await api.activity.log({id,subject_id:subject,topic_id:topic || null,session_type:kind,started_at:new Date(start).toISOString(),ended_at:new Date(end).toISOString(),notes,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});setRequestId('');setStart('');setEnd('');setNotes('');setData(await api.activity.get());await refreshAll();}catch(e){setError(e instanceof Error?e.message:'Could not save session');}finally{setBusy(false);}
 }
 return <section id="study-activity" className="mb-6 rounded-3xl border border-highlight/40 bg-card p-5">
  <h2 className="font-bold">Study activity & XP</h2>
  {data && <p className="my-2 text-primary">Level {data.level} · {data.xp} XP · {data.next_level_xp} XP to next level</p>}
  <details className="text-sm text-muted"><summary>How XP works</summary><p>First topic completion: 50 XP. Each submitted quiz: score ÷ 5, rounded (0–20 XP). Study sessions: 1 XP per complete five minutes, capped at 24 session XP each local day. Each 500 XP adds a level. Repeating a submission or reopening a topic earns no duplicate award.</p></details>
  {error && <p role="alert" className="my-2 text-red-600">{error}</p>}
  <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
   <label>Subject<select required value={subject} onChange={e=>{setSubject(e.target.value);setTopic('');}} className="block rounded border bg-card p-2"><option value="">Select subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)} className="block rounded border bg-card p-2"><option value="">General study</option>{(units[subject] || []).flatMap(u=>topics[u.id] || []).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <label>Type<select value={kind} onChange={e=>setKind(e.target.value)} className="block rounded border bg-card p-2">{['focus','revision','quiz','task'].map(k=><option key={k}>{k}</option>)}</select></label>
   <label>Started<input required type="datetime-local" value={start} onChange={e=>{setStart(e.target.value);setRequestId('');}} className="block rounded border bg-card p-2"/></label>
   <label>Ended<input required type="datetime-local" value={end} onChange={e=>{setEnd(e.target.value);setRequestId('');}} className="block rounded border bg-card p-2"/></label>
   <label>Notes<input value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000} className="block rounded border bg-card p-2"/></label>
   <button disabled={busy} className="rounded bg-primary px-4 py-2 text-white">{busy?'Saving…':'Log completed session'}</button>
  </form>
  {data && <details className="mt-4 text-sm"><summary>History ({data.sessions.length} sessions)</summary><ul>{data.sessions.slice(0,20).map(s=><li key={s.id} className="py-1">{new Date(s.started_at).toLocaleString()} · {subjects.find(x=>x.id===s.subject_id)?.name || 'Subject'} · {s.duration_minutes} min · {s.session_type}</li>)}</ul><p className="mt-3 font-bold">Recent XP awards</p><ul>{data.events.slice(0,10).map(e=><li key={e.id}>{e.activity_key.split(':')[0]} · +{e.amount} XP · {new Date(e.created_at).toLocaleDateString()}</li>)}</ul></details>}
 </section>;
}
