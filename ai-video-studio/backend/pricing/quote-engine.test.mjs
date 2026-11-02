import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStudioQuote} from './quote-engine.mjs';

const rates = {
 version: 'unit-test',
 models: {'gpt-6-luna':{inputUSDPerMTok:0.1,outputUSDPerMTok:0.5}},
 operations: {render:0.002,storage:0.01,download:0.02,image_generation:0.03,video_generation:0.10,audio_generation:0.02,other:0.05},
 business: {reserveFraction:0.2,targetGrossMargin:0.25,paymentFeeFraction:0.03,paymentFeeFixedUSD:0.20,overheadUSDPerOrder:0.1,minimumSaleUSD:0.8}
};

test('costs all operations and adds margins, fees and reserve',()=>{
 const quote=calculateStudioQuote({operations:[
  {type:'model',model:'gpt-6-luna',inputTokens:2000,outputTokens:1000},
  {type:'render',units:100},
  {type:'storage',units:20}
 ]},rates);
 assert.equal(quote.costUSD,0.4007);
 assert.equal(quote.customerPriceUSD,1.09);
 assert.equal(quote.payable,false);
});

test('unknown rate cannot silently become a free service',()=>{
 const missing={...rates,operations:{...rates.operations,video_generation:null}};
 assert.throws(()=>calculateStudioQuote({operations:[{type:'video_generation',units:10}]},missing),/No measured rate/);
});

test('unknown model cannot become a free inference call',()=>{
 assert.throws(()=>calculateStudioQuote({operations:[{type:'model',model:'unknown',inputTokens:1,outputTokens:1}]},rates),/unpriced model/);
});

test('rejects unsafe payment economics',()=>{
 const unsafe={...rates,business:{...rates.business,targetGrossMargin:0.99}};
 assert.throws(()=>calculateStudioQuote({operations:[{type:'render',units:1}]},unsafe),/Unsafe quote/);
});
