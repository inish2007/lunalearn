import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CreateTaskSchema, UpdateTaskSchema, CreateExamSchema, UpdateExamSchema } from '../types/domain.js';
async function main(){
 const cwd=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'luna-hardening-'));process.chdir(dir);
 process.env.NODE_ENV='test';process.env.SUPABASE_URL='https://placeholder.supabase.co';process.env.SUPABASE_ANON_KEY='placeholder-anon-key';process.env.SUPABASE_SERVICE_ROLE_KEY='placeholder-service-key';
 let passed=0,failed=0;const test=async(name:string,fn:()=>unknown)=>{try{await fn();passed++;}catch(e){failed++;console.error(`FAIL ${name}: ${e instanceof Error?e.message:e}`);}};
 const {server}=await import('../index.js');await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as {port:number};
 const {LocalDevStore}=await import('../lib/local-store.js');const store=LocalDevStore.getInstance();
 const a=await store.signUp({email:'a@example.test',password:'fixture-only-password',full_name:'A'});const b=await store.signUp({email:'b@example.test',password:'fixture-only-password',full_name:'B'});
 const db:any=store.createClient(a.user.id),other:any=store.createClient(b.user.id);
 const subject=(await db.from('subjects').insert({profile_id:a.user.id,name:'Owned'}).select('*').single()).data;
 const foreign=(await other.from('subjects').insert({profile_id:b.user.id,name:'Foreign'}).select('*').single()).data;
 async function call(route:string,method='GET',body?:unknown,version?:string,user=a.user.id){const r=await fetch(`http://127.0.0.1:${address.port}/api${route}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer local-dev-jwt-${user}`} : {}),...(version?{'If-Match':version}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json() as any};}
 try{
 await test('whitespace task create/update',()=>{assert.equal(CreateTaskSchema.safeParse({title:'   '}).success,false);assert.equal(UpdateTaskSchema.safeParse({title:'\t'}).success,false);});
 await test('whitespace exam create/update',()=>{assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:' ',exam_date:'2096-02-29T00:00:00Z'}).success,false);assert.equal(UpdateExamSchema.safeParse({title:' '}).success,false);});
 for(const value of ['2024-01-01T00:00:00Z','2097-02-29T00:00:00Z','invalid'])await test('invalid/past exam '+value,()=>assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'Exam',exam_date:value}).success,false));
 await test('valid leap day',()=>assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'📚 Exam',exam_date:'2096-02-29T00:00:00Z',target_score:0}).success,true));
 await test('exam target_score limits', () => {
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'Exam',exam_date:'2096-02-29T00:00:00Z',target_score:101}).success, false);
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'Exam',exam_date:'2096-02-29T00:00:00Z',target_score:-1}).success, false);
  assert.equal(UpdateExamSchema.safeParse({target_score:101}).success, false);
  assert.equal(UpdateExamSchema.safeParse({target_score:-1}).success, false);
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'Exam',exam_date:'2096-02-29T00:00:00Z',target_score:100}).success, true);
 });
 await test('exam title length limits', () => {
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'e'.repeat(201),exam_date:'2096-02-29T00:00:00Z'}).success, false);
  assert.equal(UpdateExamSchema.safeParse({title:'e'.repeat(201)}).success, false);
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'e'.repeat(200),exam_date:'2096-02-29T00:00:00Z'}).success, true);
 });
 await test('unicode and emoji titles supported', () => {
  assert.equal(CreateTaskSchema.safeParse({title:'🔥 Complete Unit 3 · データベース 🚀'}).success, true);
  assert.equal(CreateExamSchema.safeParse({subject_id:subject.id,title:'🏆 Midterm Exam · 期末試験 🎯',exam_date:'2096-02-29T00:00:00Z'}).success, true);
 });
 for(const payload of [{title:''},{title:'x'.repeat(251)},{title:'Valid',estimated_minutes:0},{title:'Valid',estimated_minutes:-1}])await test('task input limits',()=>assert.equal(CreateTaskSchema.safeParse(payload).success,false));
 await test('task update estimate limits', () => {
  assert.equal(UpdateTaskSchema.safeParse({estimated_minutes:0}).success, false);
  assert.equal(UpdateTaskSchema.safeParse({estimated_minutes:-5}).success, false);
  assert.equal(UpdateTaskSchema.safeParse({estimated_minutes:10081}).success, false);
  assert.equal(UpdateTaskSchema.safeParse({estimated_minutes:120}).success, true);
 });
 await test('conditional update is atomic',async()=>{const row=(await db.from('tasks').insert({profile_id:a.user.id,title:'CAS fixture'}).select('*').single()).data;const one=db.from('tasks').update({title:'one'}).eq('id',row.id).eq('updated_at',row.updated_at);const two=db.from('tasks').update({title:'two'}).eq('id',row.id).eq('updated_at',row.updated_at);assert.ok((await one.select('*').single()).data);assert.equal((await two.select('*').single()).data,null);});
 for(const name of ['tasks','exams'])await test(name+' repeated create is idempotent',async()=>{const id=randomUUID(),payload={id,title:'Repeat',subject_id:subject.id,...(name==='exams'?{exam_date:'2096-02-29T00:00:00Z'}:{})};const rows=await Promise.all([call('/'+name,'POST',payload),call('/'+name,'POST',payload)]);assert.equal(rows[0].data.id,id);assert.equal(rows[1].data.id,id);assert.equal((await call('/'+name)).data.filter((r:any)=>r.id===id).length,1);});
 const task=(await call('/tasks','POST',{title:'<script>alert(1)</script> 📚',subject_id:subject.id,due_date:'2096-02-29T00:00:00Z'})).data;
 await test('foreign subject reparent rejected',async()=>assert.equal((await call(`/tasks/${task.id}`,'PATCH',{subject_id:foreign.id})).status,403));
 await test('deadline cleared',async()=>assert.equal((await call(`/tasks/${task.id}`,'PATCH',{due_date:null})).data.due_date,null));
 await test('task ownership GET PATCH DELETE',async()=>{for(const method of ['GET','PATCH','DELETE'])assert.equal((await call(`/tasks/${task.id}`,method,method==='PATCH'?{title:'Hijack'}:undefined,undefined,b.user.id)).status,404);});
 await test('unauthenticated task',async()=>assert.equal((await call('/tasks','GET',undefined,undefined,'')).status,401));
 const exam=(await call('/exams','POST',{subject_id:subject.id,title:'Exam',exam_date:'2096-02-29T00:00:00Z'})).data;
 await test('exam ownership GET PATCH DELETE',async()=>{for(const method of ['GET','PATCH','DELETE'])assert.equal((await call(`/exams/${exam.id}`,method,method==='PATCH'?{title:'Hijack'}:undefined,undefined,b.user.id)).status,404);});
 await test('past date change rejected',async()=>assert.equal((await call(`/exams/${exam.id}`,'PATCH',{exam_date:'2024-01-01T00:00:00Z'})).status,400));
 await db.from('exams').update({exam_date:'2024-01-01T00:00:00Z'}).eq('id',exam.id);
 await test('historical exam title editable',async()=>assert.equal((await call(`/exams/${exam.id}`,'PATCH',{title:'Archived exam'})).status,200));
 await test('concurrent task updates only one winner',async()=>{const current=(await call(`/tasks/${task.id}`)).data;const results=await Promise.all(['First','Second'].map(title=>call(`/tasks/${task.id}`,'PATCH',{title},current.updated_at)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);});
 await test('concurrent exam updates only one winner',async()=>{const current=(await call(`/exams/${exam.id}`)).data;const results=await Promise.all(['First','Second'].map(title=>call(`/exams/${exam.id}`,'PATCH',{title},current.updated_at)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);});
 await test('completion reversal refreshes readiness without task XP',async()=>{await call(`/tasks/${task.id}`,'PATCH',{type:'Assignment',is_completed:false});const before=(await call(`/readiness/${subject.id}`)).data;const profileBefore=(await call('/auth/me')).data.profile;for(const done of [true,false,true]){assert.equal((await call(`/tasks/${task.id}`,'PATCH',{is_completed:done})).status,200);const current=(await call(`/readiness/${subject.id}`)).data;assert.equal(current.readiness_percentage,before.readiness_percentage+(done?10:0));}assert.equal((await call('/auth/me')).data.profile.xp,profileBefore.xp);});
 await test('topic recompletion awards XP once',async()=>{const unit=(await call('/units','POST',{subject_id:subject.id,title:'Unit',unit_number:1})).data;const topic=(await call('/topics','POST',{unit_id:unit.id,title:'Topic'})).data;for(const status of ['completed','not_started','completed'])await call('/topics/'+topic.id,'PATCH',{status});const events=(await db.from('xp_events').select('*')).data.filter((r:any)=>r.activity_key==='topic:'+topic.id);assert.equal(events.length,1);assert.equal(events[0].amount,50);});
 await test('subject deletion preserves general tasks and sessions',async()=>{const linked=(await call('/tasks','POST',{title:'Keep',subject_id:subject.id})).data;await db.from('study_sessions').insert({profile_id:a.user.id,subject_id:subject.id,duration_minutes:5,started_at:'2026-01-01T00:00:00Z'});assert.equal((await call('/subjects/'+subject.id,'DELETE')).status,200);assert.equal((await call('/tasks/'+linked.id)).data?.subject_id,null);const sessions=await db.from('study_sessions').select('*');assert.ok(sessions.data.every((r:any)=>r.subject_id!==subject.id));assert.equal((await call('/exams/'+exam.id)).status,404);});
 await test('exam deletion removes exam without orphans', async () => {
  const e = (await call('/exams', 'POST', { subject_id: foreign.id, title: 'Temp Exam', exam_date: '2096-03-01T00:00:00Z' }, undefined, b.user.id)).data;
  assert.equal((await call(`/exams/${e.id}`, 'DELETE', undefined, undefined, b.user.id)).status, 200);
  assert.equal((await call(`/exams/${e.id}`, 'GET', undefined, undefined, b.user.id)).status, 404);
 });
 await test('task deletion removes task cleanly', async () => {
  const t = (await call('/tasks', 'POST', { title: 'Temp Task' })).data;
  assert.equal((await call(`/tasks/${t.id}`, 'DELETE')).status, 200);
  assert.equal((await call(`/tasks/${t.id}`, 'GET')).status, 404);
 });
 }finally{await new Promise<void>(r=>server.close(()=>r()));process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
 console.log(`Productivity: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
