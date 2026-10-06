/** Opt-in real HTTP core loop; use ONLY the disposable preview-fixture server. */
import assert from 'node:assert/strict';
function createSyntheticPdf(pagesContent: string[]): Buffer {
  const numPages = pagesContent.length;
  // Obj 1: Catalog
  // Obj 2: Pages container
  // Obj 3..2+N: Page objects
  // Obj 3+N..2+2N: Content streams

  const pageObjIds: string[] = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(`${3 + i} 0 R`);
  }

  // Obj 1: Catalog
  const catalog = `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`;
  // Obj 2: Pages
  const pagesObj = `2 0 obj\n<</Type/Pages/Kids[${pageObjIds.join(' ')}]/Count ${numPages}>>\nendobj\n`;

  let body = catalog + pagesObj;

  // Pages and content streams
  for (let i = 0; i < numPages; i++) {
    const rawLines = pagesContent[i].split('\n').map(l => l.trim()).filter(Boolean);
    const textOps = rawLines.map(l => `(${l.replace(/[()\\]/g, '')}) '`).join('\n');
    const streamContent = `BT\n/F1 12 Tf\n20 750 Td\n15 TL\n${textOps}\nET`;
    const streamObjId = 3 + numPages + i;
    const pageObj = `${3 + i} 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>/Contents ${streamObjId} 0 R>>\nendobj\n`;
    const streamObj = `${streamObjId} 0 obj\n<</Length ${Buffer.byteLength(streamContent)}>>\nstream\n${streamContent}\nendstream\nendobj\n`;
    body += pageObj + streamObj;
  }

  const pdfStr = `%PDF-1.4\n${body}xref\n0 ${3 + 2 * numPages}\n0000000000 65535 f \n`;
  const trailer = `trailer\n<</Size ${3 + 2 * numPages}/Root 1 0 R>>\nstartxref\n${pdfStr.length}\n%%EOF`;

  return Buffer.from(pdfStr + trailer, 'latin1');
}

async function main(){
 const base='http://localhost:4000/api';let token='';let checks=0;
 const check=(value:unknown,label:string)=>{assert.ok(value,label);checks++;};
 async function call(route:string,method='GET',body?:unknown){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const j:any=await r.json();if(!r.ok)throw new Error(`${route}: ${j.error?.message || j.message || r.status}`);return j.data ?? j;}
 const email=`verification-${Date.now()}@example.com`;
 await call('/auth/signup','POST',{email,password:'password123',full_name:'Verification Student',course:'DBMS',semester:4});
 const auth=await call('/auth/login','POST',{email,password:'password123'});token=auth.session.access_token;check(!!token,'Login');
 await call('/auth/me','PATCH',{available_hours_per_day:2,focus_start:'00:00',focus_end:'23:59',timezone:'UTC'});
 const subject=await call('/subjects','POST',{name:'Verification DBMS',code:'VERIFY'});
 const unit=await call('/units','POST',{subject_id:subject.id,title:'Normalization',unit_number:1});
 const topic=await call('/topics','POST',{unit_id:unit.id,title:'Normalization',estimated_study_hours:0.5,status:'not_started'});
 await call('/tasks','POST',{subject_id:subject.id,title:'Review notes',type:'Assignment',priority:'High',estimated_minutes:15,due_date:new Date(Date.now()+86400000).toISOString()});
 await call('/exams','POST',{subject_id:subject.id,title:'DBMS test',exam_date:new Date(Date.now()+6*86400000).toISOString(),target_score:80});
 const before=await call(`/readiness/${subject.id}`);check(before.basis.topics.total===1,'Readiness basis');
 const pdf=createSyntheticPdf(['First normal form requires atomic values. Second normal form removes partial dependencies on a composite key. Third normal form removes transitive dependencies. Boyce Codd normal form requires each determinant of a nontrivial functional dependency to be a superkey. A lossless decomposition permits reconstruction by joining the decomposed relations. Dependency preservation allows constraints to be checked without joining relations.']);
 const upload=await call('/rag/upload','POST',{subject_id:subject.id,file_name:'verification-notes.pdf',file_base64:pdf.toString('base64')});check(upload.material.processed,'Actual PDF indexed');
 const content=await fetch(base+`/materials/${upload.material.id}/content`,{headers:{Authorization:`Bearer ${token}`}});assert.deepEqual(Buffer.from(await content.arrayBuffer()),pdf);checks++;
 const assistant=await call('/assistant/chat','POST',{subject_id:subject.id,material_id:upload.material.id,message:'Explain BCNF using these notes. Use a heading and a short list.',conversation_history:[]});check(assistant.sources.length>0,'Assistant citations');check(typeof assistant.is_fallback==='boolean' && !!assistant.answer,'Assistant answer includes explicit provenance');
 const quiz=await call('/quiz/generate','POST',{subject_id:subject.id,topic_id:topic.id,material_id:upload.material.id,num_questions:2,question_type:'multiple_choice',difficulty:'medium'});check(!quiz.is_fallback && quiz.questions.length===2,'Live grounded quiz');
 const result=await call('/quiz/submit','POST',{quiz_id:quiz.quiz_id,subject_id:subject.id,answers:quiz.questions.map((q:any)=>({question_id:q.id,user_answer:'Deliberately incorrect fixture answer',correct_answer:'Deliberately incorrect fixture answer'}))});check(result.score===0,'Authoritative scoring');check(result.weak_topics_identified.includes('Normalization'),'Weak feedback');
 const after=await call(`/readiness/${subject.id}`);check(after.basis.quizzes.count===1,'New quiz reaches readiness');
 const planner=await call('/planner/context');check(planner.study_plan.blocks.some((b:any)=>b.topic_id===topic.id && b.reason.includes('Weak')),'Mission updates to weak-topic work');
 console.log(JSON.stringify({passed:checks,failed:0,email,subjectId:subject.id,materialId:upload.material.id,assistantModel:assistant.model,assistantFallback:assistant.is_fallback,quizModel:quiz.model,fixtureOnly:true}));
}
main().catch(e=>{console.error('HTTP core loop FAILED:',e.message);process.exitCode=1;});
