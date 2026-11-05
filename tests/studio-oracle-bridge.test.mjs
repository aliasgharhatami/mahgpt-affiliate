import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as claim} from '../functions/api/studio/worker/claim.js';
import {onRequestGet as input} from '../functions/api/studio/worker/input.js';
import {onRequestPost as output} from '../functions/api/studio/worker/output.js';
import {ready} from '../functions/_lib/studio-oracle.js';
const id='f71fc3c6-bfa4-43bd-8b45-2a7fcd29780e';
const owner='0a8fcf7b-522a-4f0e-8499-4b98335289a7';
const asset='ad7efed2-57e3-44cc-820b-3763f6a9d634';
const lease='da7d438e-663b-4b1f-acb1-adeccba3b4ac';
const workerSecret='test-worker-only-secret-'+('x'.repeat(45));
function env(){
 const files=new Map();
 return {STUDIO_ORACLE_PILOT_ENABLED:'true',
 STUDIO_ORACLE_WORKER_TOKEN:workerSecret,
 STUDIO_SUPABASE_SERVICE_ROLE_JWT:'test-service-role-only-'+('q'.repeat(45)),
 STUDIO_MEDIA:{
  files,async get(key){const b=files.get(key);return b?{size:b.length,body:b}:null;},
  async put(key,b){files.set(key,Buffer.from(b));},async head(key){
   const b=files.get(key);return b?{size:b.length}:null;},
  async delete(key){files.delete(key);}
 }};
}
function request(path,method='POST',{token=workerSecret,headers={},body}={}){
 return new Request('https://mahgpt.com/api/studio/worker/'+path,{
  method,headers:{Authorization:'Bearer '+token,...headers},body
 });
}
const row={id,owner_id:owner,project_id:id,lease_token:lease,
 lease_expires_at:new Date(Date.now()+15*60_000).toISOString(),status:'rendering'};
async function withFetch(handler,fn){
 const old=globalThis.fetch;globalThis.fetch=handler;
 try{return await fn()}finally{globalThis.fetch=old}
}
test('every worker route fails closed before config',async()=>{
 const e=env();e.STUDIO_ORACLE_PILOT_ENABLED='false';
 assert.equal(ready(e),false);
 assert.equal((await claim({request:request('claim','POST'),env:e})).status,503);
 assert.equal((await input({request:request('input','GET'),env:e})).status,503);
 assert.equal((await output({request:request('output'),env:e})).status,503);
});
test('unauthorized caller cannot claim, fetch, or upload',async()=>{
 const e=env();
 assert.equal((await claim({request:request('claim','POST',{token:'bad',body:'{}'}),env:e})).status,401);
 assert.equal((await input({request:request('input','GET',{token:'bad'}),env:e})).status,401);
 assert.equal((await output({request:request('output','POST',{token:'bad'}),env:e})).status,401);
});
test('claim yields job only with private worker authentication',async()=>{
 const e=env();let calls=0;
 const result=await withFetch(async (url,opts)=>{
  calls++;
  assert.equal(url.endsWith('/rpc/studio_worker_claim'),true);
  assert.equal(opts.headers.Authorization,'Bearer '+e.STUDIO_SUPABASE_SERVICE_ROLE_JWT);
  return Response.json({id,lease,preset:'brief-preview-v1'});
 },()=>claim({env:e,request:request('claim','POST',{
  headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'claim'})
 })}));
 assert.equal(result.status,200);assert.equal((await result.json()).job.id,id);
 assert.equal(calls,1);
});
test('input read never accepts unrelated asset paths',async()=>{
 const e=env();let calls=0;
 const res=await withFetch(async url=>{
  calls++;
  return Response.json(calls===1?[row]:[{id:asset,storage_path:'other-owner/r2/bad',
   byte_size:123,media_type:'image/png',status:'ready',storage_provider:'r2'}]);
 },()=>input({env:e,request:request('input?job_id='+id+'&lease='+lease+'&asset_id='+asset,'GET')}));
 assert.equal(res.status,404);
 assert.equal(e.STUDIO_MEDIA.files.size,0);
});
test('MP4 completion writes to one server-selected key before database finalization',async()=>{
 const e=env();let calls=0;
 const bytes=Buffer.alloc(2048);bytes.write('ftyp',4);
 const result=await withFetch(async url=>{
  calls++;
  if(calls===1)return Response.json([row]);
  assert.equal(url.endsWith('/rpc/studio_worker_finish'),true);
  const path=owner+'/'+id+'/r2/render/'+id+'/final.mp4';
  assert.equal(e.STUDIO_MEDIA.files.get(path)?.length,bytes.length);
  return Response.json(true);
 },()=>output({env:e,request:request('output','POST',{
  headers:{'Content-Type':'video/mp4','X-Job-Id':id,'X-Job-Lease':lease},
  body:bytes
 })}));
 assert.equal(result.status,201);
 assert.equal((await result.json()).completed,true);
 assert.equal(calls,2);
});
test('forged output format is rejected before accessing R2',async()=>{
 const e=env();
 const data=Buffer.alloc(2000);
 const res=await withFetch(async()=>Response.json([row]),()=>output({env:e,
  request:request('output','POST',{headers:{
   'Content-Type':'video/mp4','X-Job-Id':id,'X-Job-Lease':lease},body:data})
 }));
 assert.equal(res.status,415);
 assert.equal(e.STUDIO_MEDIA.files.size,0);
});
