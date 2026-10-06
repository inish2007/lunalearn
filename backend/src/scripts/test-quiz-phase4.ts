/** Real service integration with an isolated local store and mocked provider responses. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {LocalDevStore} from '../lib/local-store.js';
import {QuizService} from '../services/quiz.service.js';
import {EmbeddingService} from '../services/embedding.service.js';
import {StudyAssistantService} from '../services/study-assistant.service.js';
import {geminiCircuitBreaker} from '../lib/circuit-breaker.js';
import {RagMaterialService} from '../services/rag-material.service.js';
import {StorageService} from '../services/storage.service.js';
import {RagJobsService} from '../services/rag-jobs.service.js';
import {PdfService} from '../services/pdf.service.js';
import {AcademicEngineService} from '../services/academic-engine.service.js';
import {PlannerContextService} from '../services/planner-context.service.js';

async function main() {
 const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'luna-quiz-'));
 const originalFetch=global.fetch,originalKey=EmbeddingService.getApiKey,originalBatch=EmbeddingService.embedBatch,originalEmbed=EmbeddingService.embedText,originalExtract=PdfService.extractText;
 process.chdir(temp);
 try {
  const store=LocalDevStore.getInstance(),profile=crypto.randomUUID(),subject=crypto.randomUUID(),unit=crypto.randomUUID(),topic=crypto.randomUUID();
  const db:any=store.createClient(profile);
  await db.from('profiles').insert({id:profile,full_name:'Fixture student',available_hours_per_day:2});
  await db.from('subjects').insert({id:subject,profile_id:profile,name:'DBMS',code:'CS401'});
  await db.from('units').insert({id:unit,subject_id:subject,title:'Normalization',unit_number:1});
  await db.from('topics').insert({id:topic,unit_id:unit,title:'Normalization',status:'not_started',is_weak:false,estimated_study_hours:1});
  EmbeddingService.getApiKey=()=> 'fixture-key';
  const input={subject_id:subject,topic_id:topic,num_questions:2,question_type:'multiple_choice' as const,difficulty:'adaptive' as const};
  await assert.rejects(()=>QuizService.generateQuiz(db,profile,input),/readable, indexed PDF/);
  // Extraction/provider seams are fixtures; storage, chunking, indexing and all database services are real.
  const text='Normalization removes redundancy. A functional dependency relates a determinant to dependent attributes. In BCNF every nontrivial determinant must be a superkey. Decomposition should preserve lossless joins. ';
  PdfService.extractText=async()=>({pages:[{pageNumber:1,text}],totalPages:1,fullText:text,characterCount:text.length} as any);
  EmbeddingService.embedBatch=async texts=>texts.map(()=>[1,0]);
  EmbeddingService.embedText=async()=>[1,0];
  const bytes=Buffer.from('%PDF-1.4 fixture bytes');
  const ingestion=await RagMaterialService.processAndIndexPdf({db,profileId:profile,subjectId:subject,fileName:'notes.pdf',fileBuffer:bytes});
  assert.equal(ingestion.material.processed,true);
  const original=await StorageService.readPdf(db,ingestion.material.storage_path);
  assert.deepEqual(original,bytes);
  let calls=0,mode='valid';
  const source=(await db.from('document_chunks').select('*')).data[0].id;
  global.fetch=(async(_url:any,options:any)=>{
   calls++;
   if(mode==='provider_failure')return new Response('{}',{status:503});
   const body=JSON.parse(options.body);
   if(body.system_instruction)return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'## BCNF\nEvery determinant is a **superkey**.'}]}}]}));
   assert.ok(body.contents[0].parts[0].text.includes(text.trim()),'Prompt receives full source text');
   const questions=[0,1].map(i=>({question:`Which determinant satisfies BCNF in scenario ${calls}-${i}?`,type:'multiple_choice',options:['A) Superkey','B) Any attribute','C) Duplicate','D) Null'],correct_answer:'A) Superkey',explanation:'BCNF requires a superkey determinant.',source_id:mode==='bad_source'?'foreign':source,topic_id:topic}));
   if(mode==='duplicate')questions[1].question=questions[0].question;
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({questions})}]}}]}));
  }) as typeof fetch;
  const quiz=await QuizService.generateQuiz(db,profile,input);
  assert.equal(quiz.is_fallback,false);assert.match(quiz.notice!,/medium/);assert.equal(quiz.questions.length,2);
  assert.ok(quiz.questions.every(q=>q.correct_answer==='' && q.source?.material_id===ingestion.material.id));
  const scored=await QuizService.scoreAndSubmitQuiz(db,profile,{quiz_id:quiz.quiz_id,subject_id:subject,answers:quiz.questions.map(q=>({question_id:q.id,user_answer:'B) Any attribute',correct_answer:'B) Any attribute'}))});
  assert.equal(scored.score,0);assert.ok(scored.weak_topics_identified.includes('Normalization'));
  assert.equal((await db.from('topics').select('*').eq('id',topic).single()).data.is_weak,true);
  store.reloadState();
  const replay=await QuizService.scoreAndSubmitQuiz(db,profile,{quiz_id:quiz.quiz_id,subject_id:subject,answers:quiz.questions.map(q=>({question_id:q.id,user_answer:'A) Superkey'}))});
  assert.equal(replay.quiz_result_id,scored.quiz_result_id);assert.equal(replay.score,0);
  const easier=await QuizService.generateQuiz(db,profile,input);assert.match(easier.notice!,/easy/);
  mode='duplicate';const before=calls;await assert.rejects(()=>QuizService.generateQuiz(db,profile,input),/repeated questions/);assert.equal(calls-before,2);
  mode='bad_source';await assert.rejects(()=>QuizService.generateQuiz(db,profile,input),/incomplete/);
  mode='valid';const answer=await StudyAssistantService.askAssistant(db,profile,{message:'Explain BCNF',subject_id:subject,conversation_history:[]});assert.equal(answer.is_fallback,false);assert.ok(answer.sources.length);assert.match(answer.answer,/## BCNF/);
  const readiness=await AcademicEngineService.getSubjectReadiness(db,subject);assert.equal(readiness.basis?.quizzes.count,1);
  const planner=await PlannerContextService.getPlannerContext(db,profile);assert.ok(planner.subjects[0].weak_and_unfinished_topics.some(t=>t.id===topic && t.is_weak));
  EmbeddingService.getApiKey=()=>null;await assert.rejects(()=>QuizService.generateQuiz(db,profile,input),/not configured/);EmbeddingService.getApiKey=()=> 'fixture-key';
  mode='provider_failure';await assert.rejects(()=>QuizService.generateQuiz(db,profile,input),/could not generate/);
  for(let i=0;i<5;i++)geminiCircuitBreaker.recordFailure(new Error('fixture failure'));
  const noCalls=calls;await assert.rejects(()=>QuizService.generateQuiz(db,profile,input));assert.equal(calls,noCalls,'Open circuit never invents a quiz');
  const fallback=await StudyAssistantService.askAssistant(db,profile,{message:'Explain BCNF',subject_id:subject,conversation_history:[]});assert.equal(fallback.is_fallback,true);
  EmbeddingService.embedBatch=async()=>{throw new Error('Embedding unavailable');};
  await assert.rejects(()=>RagMaterialService.processAndIndexPdf({db,profileId:profile,subjectId:subject,fileName:'retry.pdf',fileBuffer:bytes}),/Embedding unavailable/);
  const retained=(await db.from('materials').select('*')).data.find((m:any)=>m.name==='retry.pdf');assert.equal(retained.processed,false);assert.deepEqual(await StorageService.readPdf(db,retained.storage_path),bytes);
  assert.equal(RagJobsService.getProgressPercentage('EMBEDDING'),null);
  console.log('PASS: ingestion, actual bytes, grounded generation, difficulty, duplicate/citation validation, authoritative scoring/restart, weak feedback, assistant sources/fallback, provider/circuit/config failure, retained originals.');
 }finally {global.fetch=originalFetch;EmbeddingService.getApiKey=originalKey;EmbeddingService.embedBatch=originalBatch;EmbeddingService.embedText=originalEmbed;PdfService.extractText=originalExtract;process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
