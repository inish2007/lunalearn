/** Opt-in live verification. Only public synthetic study text is sent to Gemini. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {LocalDevStore} from '../lib/local-store.js';import {QuizService} from '../services/quiz.service.js';import {EmbeddingService} from '../services/embedding.service.js';
async function main(){
 if(!EmbeddingService.getApiKey()){console.log('UNVERIFIED: Gemini not configured');process.exitCode=2;return;}
 const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'luna-live-'));process.chdir(temp);
 try{
 const profile=crypto.randomUUID(),subject=crypto.randomUUID(),material=crypto.randomUUID();const db:any=LocalDevStore.getInstance().createClient(profile);
 await db.from('subjects').insert({id:subject,profile_id:profile,name:'Database systems',code:'DBMS'});
 await db.from('materials').insert({id:material,profile_id:profile,subject_id:subject,name:'Public fixture notes',processed:true,storage_path:'fixture-only'});
 await db.from('document_chunks').insert({id:crypto.randomUUID(),profile_id:profile,material_id:material,chunk_index:0,page_number:1,content:'A relation is in first normal form when each attribute contains atomic values. Second normal form removes partial dependencies on a composite candidate key. Third normal form removes transitive dependencies of non-key attributes on a key. Boyce-Codd normal form requires every determinant of a nontrivial functional dependency to be a superkey. Lossless decomposition preserves original tuples when decomposed relations are joined.'});
 const quiz=await QuizService.generateQuiz(db,profile,{subject_id:subject,num_questions:2,question_type:'multiple_choice',difficulty:'medium'});
 assert.equal(quiz.is_fallback,false);assert.equal(quiz.questions.length,2);assert.ok(quiz.questions.every(q=>q.source?.material_id===material));
 const embedding=await EmbeddingService.embedText('BCNF requires every determinant to be a superkey.');assert.equal(embedding.length,1536);
 console.log(JSON.stringify({verified:true,model:quiz.model,questions:quiz.questions.length,grounded:quiz.grounded,embeddingDimensions:embedding.length}));
 }finally{process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error('UNVERIFIED live provider:',e instanceof Error?e.message:'provider failure');process.exitCode=1;});
