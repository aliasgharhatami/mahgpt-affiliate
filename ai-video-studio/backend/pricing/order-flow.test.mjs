import test from 'node:test';
import assert from 'node:assert/strict';
import {stepOrder} from './order-flow.mjs';

test('every prepayment step supports Back and Cancel',()=>{
 for(const state of ['brief','quality','analysis','quote']){
  assert.ok(stepOrder(state,'back').stage);
  assert.equal(stepOrder(state,'cancel').stage,'cancelled');
 }
 assert.equal(stepOrder('quote','back').invalidateQuote,true);
 assert.equal(stepOrder('checkout','back').cancelCheckout,true);
});

test('payment can never be faked by client transition',()=>{
 assert.throws(()=>stepOrder('analysis','quote_ready'),/server-authorized/);
 assert.throws(()=>stepOrder('checkout','payment_verified'),/Verified payment/);
 assert.throws(()=>stepOrder('rendering','render_verified'),/Verified completed/);
 assert.equal(stepOrder('analysis','quote_ready',{serverVerifiedQuote:true}).stage,'quote');
 assert.equal(stepOrder('checkout','payment_verified',{serverVerifiedPayment:true}).stage,'rendering');
 assert.equal(stepOrder('rendering','render_verified',{serverVerifiedCompletion:true}).stage,'completed');
});

test('cancel after payment never silently asserts a refund or job stopped',()=>{
 assert.equal(stepOrder('rendering','cancel').stage,'cancel_requested');
 assert.equal(stepOrder('checkout','cancel').stage,'cancel_requested');
 assert.equal(stepOrder('rendering','back').readOnly,true);
 assert.equal(stepOrder('completed','cancel').stage,'completed');
 assert.throws(()=>stepOrder('completed','payment_verified'),/Invalid/);
});
