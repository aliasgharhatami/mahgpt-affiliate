import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validateAnalysisResult,onRequestPost
} from '../functions/api/studio/worker/analysis.js';

const base=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,base),'utf8');
const account=read('ai-video-studio/studio-account.js');
const config=read('ai-video-studio/studio-config.js');
const sql=read('ai-video-studio/backend/supabase/009_founder_ai_analysis_queue.sql');
const html=read('ai-video-studio/index.html');
const valid={
 complexity:'simple',productionApproach:'ffmpeg_text_motion',
 estimatedDurationSeconds:8,needsVoiceover:false,needsReview:false,
 summary:'Short title video'
};
const workerToken='q'.repeat(64);
const serviceKey='r'.repeat(64);
const env={
 STUDIO_ORACLE_PILOT_ENABLED:'true',
 STUDIO_ORACLE_WORKER_TOKEN:workerToken,
 STUDIO_SUPABASE_SERVICE_ROLE_JWT:serviceKey,
 STUDIO_MEDIA:{get(){},put(){}}
};
const request=(json,token='')=>new Request('https://mahgpt.com/api/studio/worker/analysis',{
 method:'POST',headers:{Authorization:token?'Bearer '+token:'',
  'Content-Type':'application/json'},body:JSON.stringify(json)
});
test('founder-only AI queue UI is opt-in; customer production remains OFF',()=>{
 assert.match(config,/aiAnalysisPilotEnabled: true/);
 assert.ok(account.includes('config.aiAnalysisPilotEnabled&&config.oraclePrivatePreviewEnabled&&oracleTester'));
 assert.match(config,/aiRenderingReady: false/);
 assert.match(config,/paymentsReady: false/);
 assert.match(account,/config.aiAnalysisPilotEnabled&&config.oraclePrivatePreviewEnabled/);
 assert.match(account,/studio_media_testers/);
 assert.match(account,/studio_ai_analysis_jobs/);
 assert.match(account,/analysisConsent.checked/);
 assert.match(account,/consent_confirmed:true/);
 assert.match(account,/hasDraftChanges\(\)/);
 assert.match(html,/Full AI editing, price estimates, and payments are not available yet/);
});
test('database enforces founder-only consent, daily max, no retries and owned RLS',()=>{
 for(const p of [
  'enable row level security','owner_id=(select auth.uid())',
  'studio_media_testers','consent_confirmed=true',
  '3 per 24 hours','attempts=1','lease_expires_at',
  'service_role','Cannot delete an intake while AI analysis is running'
 ])assert.ok(sql.includes(p),p);
 assert.ok(!sql.includes('grant insert on table public.studio_ai_analysis_jobs to anon'));
 assert.ok(sql.includes("char_length(v_brief)>1200"));
 assert.ok(!sql.includes("new.brief_snapshot=left("));
});
test('worker may only transmit approved AI classification schema',()=>{
 assert.equal(validateAnalysisResult(valid),true);
 assert.equal(validateAnalysisResult({...valid,chargeCustomerUSD:100}),false);
 assert.equal(validateAnalysisResult({...valid,complexity:'unapproved'}),false);
 assert.equal(validateAnalysisResult({...valid,summary:'x'.repeat(601)}),false);
 assert.equal(validateAnalysisResult({...valid,estimatedDurationSeconds:0}),false);
});
test('missing private authorization rejects before any Supabase operation',async()=>{
 const denied=await onRequestPost({request:request({op:'claim'}),
  env});
 assert.equal(denied.status,401);
 const disabled=await onRequestPost({request:request({op:'claim'},workerToken),
  env:{...env,STUDIO_ORACLE_PILOT_ENABLED:'false'}});
 assert.equal(disabled.status,503);
});
test('valid worker claim calls only service-only Supabase RPC',async()=>{
 const previous=globalThis.fetch;
 const log=[];
 try{
  globalThis.fetch=async(uri,opts)=>{
   log.push({uri:String(uri),opts});
   return new Response('null',{status:200,headers:{'content-type':'application/json'}});
  };
  const output=await onRequestPost({
    request:request({op:'claim'},workerToken),env
  });
  assert.equal(output.status,200);
  assert.deepEqual(await output.json(),{job:null});
  assert.equal(log.length,1);
  assert.ok(log[0].uri.endsWith('/rest/v1/rpc/studio_ai_worker_claim'));
  assert.equal(log[0].opts.headers.apikey,serviceKey);
  assert.equal(log[0].opts.headers.Authorization,'Bearer '+serviceKey);
 }finally{globalThis.fetch=previous;}
});
test('never forwards an invalid or overpriced result to the database',async()=>{
 const id='123e4567-e89b-42d3-a456-426614174000';
 const lease='123e4567-e89b-42d3-a456-426614174001';
 const oversized=await onRequestPost({request:request({
  op:'finish',job_id:id,lease,analysis:valid,
  input_tokens:200,output_tokens:30,cost_usd:0.15
 },workerToken),env});
 assert.equal(oversized.status,400);
 const unknown=await onRequestPost({request:request({
  op:'finish',job_id:id,lease,analysis:{...valid,executeShell:true},
  input_tokens:200,output_tokens:30,cost_usd:0.00008
 },workerToken),env});
 assert.equal(unknown.status,400);
});
