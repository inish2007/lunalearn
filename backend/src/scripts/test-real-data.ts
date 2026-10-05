import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalDevStore } from '../lib/local-store.js';
import { AcademicEngineService as Engine } from '../services/academic-engine.service.js';
async function main() {
const original = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lunalearn-test-'));
process.chdir(temp);
try {
  const store = LocalDevStore.getInstance();
  const db = store.createClient('student-a');
  const bytes = Buffer.from('%PDF-1.4\nreal stored bytes\n%%EOF');
  const saved = await db.storage.from('materials').upload('student-a/subject/notes.pdf', bytes);
  assert.equal(saved.error, null);
  const read = await db.storage.from('materials').download('student-a/subject/notes.pdf');
  assert.deepEqual(read.data, bytes);
  assert.ok((await store.createClient('student-b').storage.from('materials').download('student-a/subject/notes.pdf')).error);
  assert.ok((await db.storage.from('materials').download('student-a/../escape')).error);
  assert.ok((await db.storage.from('materials').download('student-a/missing.pdf')).error);
  const runId='11111111-1111-4111-8111-111111111111';
  await (db as any).from('quiz_runs').insert({id:runId,profile_id:'student-a',subject_id:'subject',questions:[{id:'q1',question:'A real question',type:'multiple_choice',correct_answer:'A',explanation:'Evidence',topic_title:'Concept'}]});
  const submitted=await (db as any).rpc('submit_quiz_run',{p_quiz_id:runId,p_answers:[{question_id:'q1',user_answer:'B',correct_answer:'B'}]});
  assert.equal(submitted.data.score,0,'Client answer keys must be ignored');
  store.reloadState();
  const replay=await (db as any).rpc('submit_quiz_run',{p_quiz_id:runId,p_answers:[{question_id:'q1',user_answer:'A'}]});
  assert.equal(replay.data.quiz_result_id,submitted.data.quiz_result_id);
  assert.equal(replay.data.score,0);
  assert.ok((await (store.createClient('student-b') as any).rpc('submit_quiz_run',{p_quiz_id:runId,p_answers:[]})).error);
  store.reloadState();
  assert.deepEqual((await db.storage.from('materials').download('student-a/subject/notes.pdf')).data, bytes);
  assert.equal(Engine.calculateTopicCompletion([]), 0);
  assert.equal(Engine.calculateAssignmentCompletion([]), 100);
  assert.equal(Engine.calculateWeightedReadiness({topic_completion:60,quiz_performance:80,revision_activity:50,assignment_completion:100}),68);
  await (db as any).from('subjects').insert({id:'subject',profile_id:'student-a',name:'Test'});
  const session={id:'session-1',subject_id:'subject',session_type:'focus',timezone:'UTC',started_at:new Date(Date.now()-150*60000).toISOString(),ended_at:new Date(Date.now()-10*60000).toISOString()};
  const logged=await (db as any).rpc('log_study_session',{p_session:session});assert.equal(logged.error,null);
  assert.equal(logged.data.duration_minutes,140);
  assert.ok((await (db as any).rpc('log_study_session',{p_session:{...session,id:'session-2'}})).error,'Overlap rejected');
  const ledger=await (db as any).from('xp_events').select('*');assert.equal(ledger.data.filter((e:any)=>e.activity_key.startsWith('session:')).reduce((n:number,e:any)=>n+e.amount,0),24);
  const again=await (db as any).rpc('log_study_session',{p_session:session});assert.equal(again.data.id,session.id);
  console.log('Real-data formulas and storage: passed');
} finally { process.chdir(original); fs.rmSync(temp, { recursive:true, force:true }); }

}
main().catch(err => { console.error(err); process.exitCode = 1; });
