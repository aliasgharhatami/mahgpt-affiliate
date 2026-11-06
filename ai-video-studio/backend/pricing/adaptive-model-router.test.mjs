import test from 'node:test';
import assert from 'node:assert/strict';
import {selectStudioDirector,STUDIO_DIRECTOR_CATALOG,STUDIO_QUALITY_TIERS}
  from './adaptive-model-router.mjs';
import {calculateStudioQuote} from './quote-engine.mjs';

const base={
 version:'official-reviewed-2026-11-06-standard',
 models:{
  'gpt-6-luna':{inputUSDPerMTok:0.1,outputUSDPerMTok:0.5},
  'gpt-6.1-terra':{inputUSDPerMTok:1,outputUSDPerMTok:5},
  'gpt-6.1-sol':{inputUSDPerMTok:2,outputUSDPerMTok:10},
  'gpt-6-astra':{inputUSDPerMTok:10,outputUSDPerMTok:50}
 }
};
const route=(quality,complexity,changes={})=>selectStudioDirector({
 quality,complexity,rateCard:base,
 estimatedInputTokens:2000,estimatedOutputTokens:1000,...changes
});

test('normal small motion-design request uses Luna rather than expensive planning',()=>{
 const picked=route('normal','simple');
 assert.equal(picked.status,'ready');
 assert.equal(picked.modelId,'gpt-6-luna');
 assert.equal(picked.reviewPasses,1);
 assert.equal(picked.estimatedDirectorCostUSD,0.0007);
 assert.equal(picked.customerPriceUSD,null);
 assert.equal(picked.payable,false);
});

test('quality and validated complexity impose appropriate model floors',()=>{
 assert.equal(route('normal','moderate').modelId,'gpt-6.1-terra');
 assert.equal(route('semi_professional','simple').modelId,'gpt-6.1-terra');
 assert.equal(route('semi_professional','advanced').modelId,'gpt-6.1-sol');
 assert.equal(route('professional','moderate').modelId,'gpt-6.1-sol');
 assert.equal(route('professional','specialist_3d',{cloud3dReady:true}).modelId,'gpt-6-astra');
 assert.equal(route('professional','specialist_3d').status,'capability_unavailable');
 assert.equal(route('normal','advanced').requiredTier,'semi_professional');
 assert.equal(route('semi_professional','specialist_3d').requiredTier,'professional');
});

test('new audited priced models can be selected without changing router logic',()=>{
 const futureCatalog=[
  ...STUDIO_DIRECTOR_CATALOG,
  {id:'future-director-v2',capabilityRank:3,enabled:true},
  {id:'unreviewed-model',capabilityRank:4,enabled:false},
 ];
 const newRates={...base,models:{...base.models,
  'future-director-v2':{inputUSDPerMTok:0.4,outputUSDPerMTok:0.8},
  'unreviewed-model':{inputUSDPerMTok:0,outputUSDPerMTok:0}
 }};
 const picked=route('professional','advanced',{catalog:futureCatalog,rateCard:newRates});
 assert.equal(picked.modelId,'future-director-v2');
});

test('no made-up pricing for unpriced newer models',()=>{
 const picked=route('professional','advanced',{
  catalog:[{id:'gpt-new-advanced',capabilityRank:4,enabled:true}]
 });
 assert.equal(picked.status,'model_unavailable');
});

test('rejects unreliable usage estimates and unsafe model rates',()=>{
 assert.throws(()=>route('normal','simple',{estimatedInputTokens:-10}),/Invalid/);
 assert.throws(()=>route('normal','simple',{estimatedInputTokens:0,estimatedOutputTokens:0}),/measured token/);
 assert.throws(()=>route('normal','simple',{rateCard:{...base,models:{
  'gpt-6-luna':{inputUSDPerMTok:-1,outputUSDPerMTok:0.5}
 }}}),/unsafe rate/);
});

test('selling price is impossible without measured media/render rates, even with cheap Luna',()=>{
 const model=route('normal','simple');
 const unmeasured={
  ...base,operations:{render:null},business:{
   reserveFraction:0.2,targetGrossMargin:0.25,paymentFeeFraction:0.03,
   paymentFeeFixedUSD:0.2,overheadUSDPerOrder:0.1,minimumSaleUSD:0.5
  }
 };
 assert.throws(()=>calculateStudioQuote({operations:[
   {type:'model',model:model.modelId,inputTokens:2000,outputTokens:1000},
   {type:'render',units:12}
 ]},unmeasured),/No measured rate for render/);
});
