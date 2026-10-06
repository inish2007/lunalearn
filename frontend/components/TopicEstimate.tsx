'use client';
import { useState } from 'react';
import { useAcademic } from '@/lib/context/AcademicContext';
import type { Topic } from '@/lib/types/academic';
export function TopicEstimate({topic,subjectId}:{topic:Topic;subjectId:string}){
 const {updateTopic}=useAcademic();const [value,setValue]=useState(topic.estimated_study_hours?.toString() || ''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="flex flex-wrap items-center gap-2" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await updateTopic(topic.id,{estimated_study_hours:value?Number(value):null},subjectId);}catch(e){setError(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}}}><label className="text-xs">Remaining hours <input aria-label={`Remaining hours for ${topic.title}`} className="w-16 rounded border bg-card p-1" type="number" min="0.01" step="0.25" value={value} onChange={e=>setValue(e.target.value)}/></label><button disabled={busy} className="text-xs text-primary">{busy?'Saving':'Save estimate'}</button>{error && <span role="alert" className="text-xs text-red-600">{error}</span>}</form>;
}
