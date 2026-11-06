import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost,presentVerifiedQuote}
 from '../functions/api/studio/estimate.js';
import {calculateStudioQuote}
 from '../ai-video-studio/backend/pricing/quote-engine.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const projectId='123e4567-e89b-42d3-a456-426614174001';
const analysisId='123e4567-e89b-42d3-a456-426614174002';
const jwt='eyJ.'+'q'.repeat(50)+'.'+'s'.repeat(50);
const secret='z'.repeat(60);
const origin='https://mahgpt.com/api/studio/estimate';
const env={
 STUDIO_ORACLE_PILOT_ENABLED:'true',
 STUDIO_ORACLE_WORKER_TOKEN:'w'.repeat(60),
 STUDIO_SUPABASE_SERVICE_ROLE_JWT:secret,
 STUDIO_MEDIA:{get(){},put(){}}
};
const request=(payload,withAuth=true)=>new Request(origin,{
 method:'POST',
 headers:{'Content-Type':'application/json',
  ...(withAuth?{Authorization:'Bearer '+jwt}:{})},
 body:JSON.stringify(payload)
});
const payload={project_id:projectId,analysis_id:analysisId};
const analysis={id:analysisId,project_id:projectId,owner_id:id,
 quality:'normal',status:'completed'};
const quote={
 status:'quoted',id:'123e4567-e89b-42d3-a456-426614174003',
 project_id:projectId,owner_id:id,analysis_job_id:analysisId,
 quality:'normal',currency:'USD',amount_minor:2900,
 expires_at:'2099-01-01T00:00:00.000Z',estimate_version:'audited-unit-test-v1',
 // Privileged data must never be returned by presentVerifiedQuote.
 internal_cost_usd:12.5,marginFraction:0.5,model:'gpt-6-luna'
};
const asJSON=x=>new Response(JSON.stringify(x),{
 status:200,headers:{'Content-Type':'application/json'}
});
test('the existing private quote lookup refuses unauthenticated requests',async()=>{
 const response=await onRequestPost({request:request(payload,false),env});
 assert.equal(response.status,401);
});
test('public browser never receives internal model costs or operation data',()=>{
 const p=presentVerifiedQuote(quote,analysis,true);
 assert.equal(p.status,'quoted');
 assert.equal(p.amount,'29.00');
 assert.equal(p.paymentReady,false);
 const body=JSON.stringify(p);
 for(const secret of ['internal_cost_usd','marginFraction','gpt-6-luna','model','tokens','plan'])
   assert.ok(!body.includes(secret),secret);
 assert.equal(p.quality,'normal');
});
test('a quote for the wrong owner, analysis or tier is rejected',()=>{
 assert.equal(presentVerifiedQuote({...quote,owner_id:projectId},analysis,true),null);
 assert.equal(presentVerifiedQuote({...quote,analysis_job_id:projectId},analysis,true),null);
 assert.equal(presentVerifiedQuote({...quote,quality:'professional'},analysis,true),null);
 assert.equal(presentVerifiedQuote({...quote,status:'draft'},analysis,true),null);
 assert.equal(presentVerifiedQuote({...quote,amount_minor:0},analysis,true),null);
 assert.equal(presentVerifiedQuote({...quote,amount_minor:2900},analysis,false),null);
 assert.equal(presentVerifiedQuote({...quote,expires_at:'2020-01-01T00:00:00Z'},analysis,true),null);
});
test('without verified rates, site reports pending and does NOT fabricate a price',async()=>{
 const calls=[];
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,opts)=>{
   calls.push({url:String(url),opts});
   if(String(url).endsWith('/auth/v1/user')){
    assert.equal(opts.headers.Authorization,'Bearer '+jwt);
    assert.equal(opts.headers.apikey,secret);
    return asJSON({id});
   }
   if(String(url).includes('/rest/v1/studio_ai_analysis_jobs')){
    assert.ok(String(url).includes('owner_id=eq.'+id));
    return asJSON([analysis]);
   }
   throw Error('Unexpected backend request '+url);
  };
  const response=await onRequestPost({request:request(payload),env});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.status,'pending_verification');
  assert.equal('amount' in result,false);
  assert.equal(calls.length,2);
 }finally{globalThis.fetch=original;}
});
test('only backend-verified customer quote may return a price',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url)=>{
   if(String(url).endsWith('/auth/v1/user'))return asJSON({id});
   if(String(url).includes('/rest/v1/studio_ai_analysis_jobs'))return asJSON([analysis]);
   if(String(url).includes('/rest/v1/studio_quotes'))return asJSON([quote]);
   throw Error('Unexpected request');
  };
  const response=await onRequestPost({request:request(payload),env:{
   ...env,STUDIO_VERIFIED_QUOTING_ENABLED:'true'
  }});
  const result=await response.json();
  assert.equal(result.status,'quoted');
  assert.equal(result.amount,'29.00');
  assert.equal(result.paymentReady,false);
  assert.ok(!JSON.stringify(result).includes('internal_cost'));
 }finally{globalThis.fetch=original;}
});
test('profit margin, processor fee and reserves change customer price in SERVER calculation',()=>{
 const base={
  version:'verified-sample-not-live',
  models:{},
  operations:{other:10},
  business:{
   reserveFraction:0,targetGrossMargin:0.5,
   paymentFeeFraction:0.03,paymentFeeFixedUSD:0.30,
   overheadUSDPerOrder:0,minimumSaleUSD:0
  }
 };
 const result=calculateStudioQuote({operations:[{type:'other',units:1}]},base);
 assert.equal(result.customerPriceUSD,21.92);
 assert.equal(result.payable,false);
 assert.throws(()=>calculateStudioQuote({operations:[{type:'render',units:1}]},base),
  /No measured rate/);
});
test('no internal Luna output or fake payment trigger is shipped to frontend',()=>{
 const js=readFileSync(new URL('../ai-video-studio/studio-account.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../ai-video-studio/index.html',import.meta.url),'utf8');
 const privacySql=readFileSync(new URL('../ai-video-studio/backend/supabase/010_private_ai_quote_visibility.sql',import.meta.url),'utf8');
 assert.ok(js.includes('thread.append(analysisPanel)'));
 assert.ok(js.includes("Estimate the cost of my request"));
 assert.ok(js.includes("['normal','Normal']"));
 assert.ok(js.includes("['semi_professional','Semi-professional']"));
 assert.ok(js.includes("['professional','Professional']"));
 assert.ok(js.includes("fetch('/api/studio/estimate'"));
 assert.ok(js.includes('analysisPanel.classList.toggle'));
 assert.ok(!js.includes('estimated_cost_usd'));
 assert.ok(!js.includes('AI analysis tokens'));
 assert.ok(!js.includes('Luna analysis completed'));
 assert.ok(!js.includes('payment.create'));
 assert.ok(html.includes('studioQuoteSpin'));
 assert.ok(privacySql.includes('revoke select on table public.studio_ai_analysis_jobs from authenticated'));
 assert.ok(privacySql.includes('grant select(id,project_id,owner_id,quality,status,error_code,created_at,completed_at)'));
});
