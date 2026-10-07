import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
async function main(){
 const cwd=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'luna-hardening-'));process.chdir(dir);
 process.env.NODE_ENV='test';process.env.SUPABASE_URL='https://placeholder.supabase.co';process.env.SUPABASE_ANON_KEY='placeholder-anon-key';process.env.SUPABASE_SERVICE_ROLE_KEY='placeholder-service-key';
 let passed=0,failed=0;const test=async(name:string,fn:()=>unknown)=>{try{await fn();passed++;}catch(e){failed++;console.error(`FAIL ${name}: ${e instanceof Error?e.message:e}`);}};
 const {server, isOriginAllowed}=await import('../index.js');await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as {port:number};
 const {LocalDevStore}=await import('../lib/local-store.js');const store=LocalDevStore.getInstance();
 const a=await store.signUp({email:'a@example.test',password:'fixture-only-password',full_name:'A'});
 async function call(route:string,method='GET',body?:unknown,version?:string,user=a.user.id){const r=await fetch(`http://127.0.0.1:${address.port}/api${route}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer local-dev-jwt-${user}`} : {}),...(version?{'If-Match':version}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json() as any};}
 try{
 await test('unconfigured CORS origin denied',async()=>{const r=await fetch(`http://127.0.0.1:${address.port}/api/health`,{headers:{Origin:'https://untrusted.example'}});assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);});
 await test('configured origin reflected',async()=>{const r=await fetch(`http://127.0.0.1:${address.port}/api/health`,{headers:{Origin:'http://localhost:3000'}});assert.equal(r.headers.get('Access-Control-Allow-Origin'),'http://localhost:3000');assert.equal(r.headers.get('Vary'),'Origin');});
 await test('production rejects loopback CORS origins', () => {
   const prodOrigins = ['https://app.lunalearn.com'];
   assert.equal(isOriginAllowed('http://localhost:3000', prodOrigins, false), false);
   assert.equal(isOriginAllowed('http://127.0.0.1:3000', prodOrigins, false), false);
   assert.equal(isOriginAllowed('http://[::1]:3000', prodOrigins, false), false);
   assert.equal(isOriginAllowed('https://app.lunalearn.com', prodOrigins, false), true);
   assert.equal(isOriginAllowed('http://localhost:3000', prodOrigins, true), true);
   assert.equal(isOriginAllowed('http://127.0.0.1:3000', prodOrigins, true), true);
 });
 await test('oversized JSON returns 413',async()=>assert.equal((await call('/tasks','POST',{title:'x'.repeat(1048600)})).status,413));
 await test('forged auth/forwarding cannot bypass auth limit',async()=>{let last=0;for(let i=0;i<17;i++){const r=await fetch(`http://127.0.0.1:${address.port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer forged-${i}`,'X-Forwarded-For':`192.0.2.${i}`},body:'{}'});last=r.status;await r.text();}assert.equal(last,429);});
 await test('production configuration validates required AI and origins',async()=>{const old={...process.env};try{process.env.NODE_ENV='production';process.env.SUPABASE_URL='https://valid.supabase.co';process.env.SUPABASE_ANON_KEY='test-valid-key';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';delete process.env.GEMINI_API_KEY;delete process.env.CORS_ORIGINS;const {getEnv}=await import('../config/env.js');assert.throws(()=>getEnv(),/CONFIGURATION/);}finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}});
 await test('logs do not retain payload or credentials',async()=>{const {logger}=await import('../lib/logger.js');const original=console.log;let output='';console.log=(s:unknown)=>{output+=String(s);};try{logger.info('event',{password:'private-fixture',body:{email:'personal@example.test'},path:'/api/tasks?token=secret-fixture'});}finally{console.log=original;}assert.ok(!output.includes('private-fixture')&&!output.includes('personal@example.test')&&!output.includes('secret-fixture'));});
 }finally{await new Promise<void>(r=>server.close(()=>r()));process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
 console.log(`Security: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
