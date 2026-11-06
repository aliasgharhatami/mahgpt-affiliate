/**
 * Quote/checkout transition contract. Pure logic, no billing side effects.
 * This file does NOT grant access, create quotes, take payments or render.
 * Server authorizations/webhooks must be the only writers of paid/complete.
 */
const stages=Object.freeze([
 'brief','quality','analysis','quote','checkout','rendering','completed',
 'cancel_requested','cancelled'
]);
export const STUDIO_ORDER_STAGES=stages;

export function stepOrder(state,event,{serverVerifiedQuote=false,serverVerifiedPayment=false,
 serverVerifiedCompletion=false}={}){
 if(!stages.includes(state))throw new Error('Unknown order stage');
 if(event==='cancel'){
  if(state==='completed')return {stage:'completed',message:'Completed work remains in My Projects; start a revision'};
  if(state==='rendering')return {stage:'cancel_requested',message:'Stop/refund eligibility must be confirmed by the server'};
  if(state==='checkout')return {stage:'cancel_requested',message:'Cancel provider checkout and verify payment state before closing'};
  if(state==='cancelled'||state==='cancel_requested')return {stage:state};
  return {stage:'cancelled',message:'Unpaid draft and quote may be released'};
 }
 if(event==='back'){
  const previous={quality:'brief',analysis:'quality',quote:'quality',checkout:'quote'};
  if(previous[state])return {stage:previous[state],
   invalidateQuote:state==='quote'||state==='analysis',
   cancelCheckout:state==='checkout'};
  if(state==='brief')return {stage:'brief'};
  return {stage:state,readOnly:true,message:'Paid or completed operations cannot be rewound'};
 }
 const expected={
  brief:{next:'quality'},quality:{next:'analysis'},
  analysis:{quote_ready:'quote'},quote:{accept_quote:'checkout'},
  checkout:{payment_verified:'rendering'},
  rendering:{render_verified:'completed'},
  cancel_requested:{cancel_confirmed:'cancelled'}
 };
 const next=expected[state]?.[event];
 if(!next)throw new Error('Invalid stage transition');
 if(event==='quote_ready'&&!serverVerifiedQuote)throw new Error('A server-authorized priced quote is required');
 if(event==='payment_verified'&&!serverVerifiedPayment)throw new Error('Verified payment webhook required');
 if(event==='render_verified'&&!serverVerifiedCompletion)throw new Error('Verified completed render required');
 return {stage:next};
}
