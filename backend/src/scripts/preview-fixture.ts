/** Isolated manual browser-test server. Never opens the normal local database. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {env} from '../config/env.js';
async function main(){
 if(!env.SUPABASE_URL.includes('placeholder') && !env.SUPABASE_URL.includes('your-project-ref'))throw new Error('Fixture server requires local Supabase configuration.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'luna-preview-'));process.chdir(dir);process.env.NODE_ENV='test';
 const {LocalDevStore}=await import('../lib/local-store.js');const store=LocalDevStore.getInstance();
 const auth=await store.signUp({email:'aarav.patel@example.com',password:'password123',full_name:'Aarav Patel',course:'Computer Science & Engineering',semester:4});
 const {seedDemoDataset}=await import('./seed-demo.js');await seedDemoDataset(store.createClient(auth.user.id),auth.user.id);
 if(process.argv.includes('--mock-ai')) {
  let sequence=0;
  global.fetch=(async(_url:any,options:any)=>{
   const body=JSON.parse(options.body);let data;
   if(body.requests)data={embeddings:body.requests.map(()=>({values:[1,...Array(1535).fill(0)]}))};
   else if(body.content)data={embedding:{values:[1,...Array(1535).fill(0)]}};
   else if(body.system_instruction)data={candidates:[{content:{parts:[{text:'## BCNF\n\n- Every determinant must be a **superkey**.\n- Check functional dependencies.\n\n```sql\nSELECT * FROM notes;\n```'}]}}]};
   else {const prompt=body.contents[0].parts[0].text;const source=prompt.match(/"source_id":"([0-9a-f-]{36})"/)[1];const count=Number(prompt.match(/exactly (\d+)/)[1]);sequence++;data={candidates:[{content:{parts:[{text:JSON.stringify({questions:Array.from({length:count},(_,i)=>({question:`In fixture scenario ${sequence}-${i}, what must a BCNF determinant be?`,type:'multiple_choice',options:['A) A superkey','B) A duplicate','C) Null','D) Any value'],correct_answer:'A) A superkey',explanation:'The supplied notes require determinants to be superkeys.',source_id:source}))})}]}}]};}
   return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  console.log('TEST ONLY: provider transport is mocked, not live Gemini verification.');
 }
 const {server}=await import('../index.js');server.listen(4000,()=>console.log('Isolated browser fixture ready on 4000'));
 process.on('SIGINT',()=>server.close(()=>{fs.rmSync(dir,{recursive:true,force:true});process.exit(0);}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
