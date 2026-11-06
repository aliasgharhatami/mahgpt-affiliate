import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateVerifiedStudioOffer} from './verified-quote-pipeline.mjs';

const projectId='b9618c79-e75e-476f-97c1-e383f5e32462';
const analysis={complexity:'moderate',productionApproach:'template_motion_graphics',
 estimatedDurationSeconds:15,needsReview:false};
const verifiedPlan={
 reviewed:true,availableInCloud:true,projectId,quality:'normal',durationSeconds:15,
 method:'template_motion_graphics',
 mediaSources:[{sourceId:'shot-a',commercialRightsVerified:true,costCoveredByOperations:true},
 {sourceId:'shot-b',commercialRightsVerified:true,costCoveredByOperations:true},
 {sourceId:'shot-c',commercialRightsVerified:true,costCoveredByOperations:true},
 {sourceId:'music-a',commercialRightsVerified:true,costCoveredByOperations:true}],
 operations:[{type:'render',units:1},{type:'other',units:1}]
};
const rateCard={
 version:'2026-11-06-measured-test-only',
 models:{'gpt-6-luna':{inputUSDPerMTok:0.1,outputUSDPerMTok:0.5}},
 operations:{render:4,other:3,storage:0,download:0},
 business:{reserveFraction:0.2,targetGrossMargin:0.4,
  paymentFeeFraction:0.03,paymentFeeFixedUSD:0.3,
  overheadUSDPerOrder:2,minimumSaleUSD:1}
};
const run=overrides=>calculateVerifiedStudioOffer({
 projectId,quality:'normal',analysis,verifiedPlan,rateCard,
 productionEnabled:true,commercialTermsApproved:true,...overrides
});
test('rejects unsupported public AI production until actually ready',()=>{
 const res=run({productionEnabled:false});
 assert.equal(res.status,'manual_review_required');
 assert.equal(res.publicQuote,null);
});
test('requires commercial media licensing and matching reviewed plan',()=>{
 const missing={...verifiedPlan,mediaSources:undefined};
 assert.equal(run({verifiedPlan:missing}).publicQuote,null);
 const noRights={...verifiedPlan,mediaSources:
  [{sourceId:'clip',commercialRightsVerified:false,costCoveredByOperations:true}]};
 assert.equal(run({verifiedPlan:noRights}).publicQuote,null);
 assert.equal(run({quality:'professional'}).publicQuote,null);
 assert.equal(run({analysis:{...analysis,needsReview:true}}).publicQuote,null);
});
test('missing measured supplier rate never becomes a free video',()=>{
 const unknown={...rateCard,operations:{render:4,other:null}};
 assert.equal(run({rateCard:unknown}).publicQuote,null);
});
test('seller amount includes reserve, overhead, processing and 40% profit margin',()=>{
 const result=run();
 assert.equal(result.status,'quote_ready');
 // Formula: ((7 * 1.2)+2+0.3)/(1-0.4-0.03)=$18.77 -> rounded up
 assert.equal(result.publicQuote.amountMinor,1878);
 assert.equal(result.publicQuote.payable,false);
 assert.equal(result.publicQuote.checkoutUrl,null);
 assert.equal(result.internalAudit.vendorCostUSD,7);
 assert.equal(result.internalAudit.coveredCostsUSD,10.4);
 assert.equal('internalAudit' in result.publicQuote,false);
 assert.equal('modelId' in result.publicQuote,false);
});
test('never forwards a negative quote, unsupported tier or invalid duration',()=>{
 assert.throws(()=>run({quality:'invalid'}),/Validated/);
 assert.throws(()=>run({analysis:{...analysis,estimatedDurationSeconds:-1}}),/duration/);
 assert.equal(run({rateCard:{...rateCard,business:{
   ...rateCard.business,targetGrossMargin:0.99
 }}}).publicQuote,null);
});
