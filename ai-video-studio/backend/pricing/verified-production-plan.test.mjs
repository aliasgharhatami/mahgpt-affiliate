import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerifiedProductionPlan} from './verified-production-plan.mjs';
import {calculateStudioQuote} from './quote-engine.mjs';

const job={
 status:'completed',quality:'normal',input_tokens:312,output_tokens:82,
 analysis:{complexity:'simple',productionApproach:'ffmpeg_text_motion',
   estimatedDurationSeconds:8,needsVoiceover:false,needsReview:false}
};
const caps={normal:{ffmpeg_text_motion:{
 verified:true,revision:'8s-ffmpeg-text-v1',assetPolicy:'text_only',
 complexities:['simple'],maxSeconds:8,verifiedVoiceover:false,
 plannedModelCalls:[{model:'gpt-6-luna',inputTokens:4000,outputTokens:900}],
 storageUnits:1,downloadUnits:1
}}};
const rateCard={
 version:'operator-verified-v1',
 models:{'gpt-6-luna':{inputUSDPerMTok:0.1,outputUSDPerMTok:0.5},
         'gpt-6.1-terra':{inputUSDPerMTok:1,outputUSDPerMTok:5}},
 operations:{render:0,storage:0,download:0,audio_generation:null},
 business:{reserveFraction:0.2,targetGrossMargin:0.25,
   paymentFeeFraction:0,paymentFeeFixedUSD:0,
   overheadUSDPerOrder:0,minimumSaleUSD:1}
};
test('real Luna usage and reserved future tokens are charged by server',()=>{
 const plan=buildVerifiedProductionPlan(job,caps,{});
 assert.equal(plan.operations[0].model,'gpt-6-luna');
 assert.equal(plan.operations[0].inputTokens,312);
 assert.equal(plan.operations[1].inputTokens,4000);
 assert.deepEqual(plan.operations.slice(2).map(x=>x.type),
   ['render','storage','download']);
 const quote=calculateStudioQuote(plan,rateCard);
 assert.equal(quote.customerPriceUSD,1);
 assert.ok(quote.costUSD>0);
 assert.equal(quote.payable,false);
});
test('higher token budgets increase price automatically, without a tier multiplier',()=>{
 const expensive={...caps,professional:{ffmpeg_text_motion:{
  ...caps.normal.ffmpeg_text_motion,plannedModelCalls:[
    {model:'gpt-6.1-terra',inputTokens:500000,outputTokens:500000}
  ]}}};
 const professional=buildVerifiedProductionPlan(
   {...job,quality:'professional'},expensive,{});
 const result=calculateStudioQuote(professional,rateCard);
 assert.ok(result.customerPriceUSD>1);
 assert.equal(result.rateCardVersion,'operator-verified-v1');
});
test('unverified or unsupported production is never silently quoted',()=>{
 const cases=[
  [{...job,analysis:{...job.analysis,needsReview:true}},caps,{}],
  [{...job,analysis:{...job.analysis,needsVoiceover:true}},caps,{}],
  [{...job,analysis:{...job.analysis,estimatedDurationSeconds:15}},caps,{}],
  [{...job,analysis:{...job.analysis,productionApproach:'generative_media_required'}},caps,{}],
  [job,caps,{hasAssets:true}],
  [job,caps,{hasReference:true}],
  [job,caps,{hasStyle:true}],
  [job,{normal:{ffmpeg_text_motion:{...caps.normal.ffmpeg_text_motion,verified:false}}},{}],
  [job,{normal:{ffmpeg_text_motion:{...caps.normal.ffmpeg_text_motion,assetPolicy:'unverified'}}},{}],
  [job,{normal:{ffmpeg_text_motion:{...caps.normal.ffmpeg_text_motion,plannedModelCalls:[
    {model:'fake-model',inputTokens:10,outputTokens:5}
  ]}}},{}]
 ];
 for(const [analysis,capability,context] of cases)
  assert.equal(buildVerifiedProductionPlan(analysis,capability,context),null);
});
test('a free tier is explicitly priced at $0 rather than assumed',()=>{
 const plan=buildVerifiedProductionPlan(job,caps,{});
 assert.ok(plan);
 const unverified={...rateCard,operations:{...rateCard.operations,render:null}};
 assert.throws(()=>calculateStudioQuote(plan,unverified),/No measured rate/);
});
