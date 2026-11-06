// Private customer price service. Only trusted, audited server configuration
// can create quotes. Never return provider rates, token usage or private plans.
// Payment and automatic commercial rendering remain DISABLED here.
import {ready,db,reply,fail,validId,errorResponse} from '../../_lib/studio-oracle.js';
import {calculateStudioQuote} from '../../../ai-video-studio/backend/pricing/quote-engine.mjs';
import {buildVerifiedProductionPlan}
 from '../../../ai-video-studio/backend/pricing/verified-production-plan.mjs';

const DB='https://gthwpfscrewwamjxheyj.supabase.co';
const QUALITY=['normal','semi_professional','professional'];
const PENDING_MESSAGE='We need to verify the production method, licensed footage, music and rendering costs before confirming your price. No payment is required.';

async function identifyOwner(request,env){
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{30,8192}$/.test(authorization))return null;
 const result=await fetch(DB+'/auth/v1/user',{
  method:'GET',
  headers:{Authorization:authorization,apikey:env.STUDIO_SUPABASE_SERVICE_ROLE_JWT},
  cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)return null;
 const user=await result.json();
 return validId(user?.id)?user.id:null;
}
export function presentVerifiedQuote(row,analysis,enabled=false){
 if(enabled!==true||row?.status!=='quoted'||
    row.analysis_job_id!==analysis.id||
    row.project_id!==analysis.project_id||
    row.owner_id!==analysis.owner_id||
    row.quality!==analysis.quality||
    row.currency!=='USD'||
    !Number.isSafeInteger(row.amount_minor)||
    row.amount_minor<100||row.amount_minor>100000000||
    !row.expires_at||Date.parse(row.expires_at)<=Date.now()||
    typeof row.estimate_version!=='string'||!row.estimate_version)
   return null;
 return {
   status:'quoted',quality:row.quality,currency:'USD',
   amount:(row.amount_minor/100).toFixed(2),
   expiresAt:row.expires_at,
   paymentReady:false // A verified quote is not a paid order.
 };
}
function privateJSON(env,key){
 const raw=env[key];
 if(typeof raw!=='string'||raw.length<2||raw.length>32000)return null;
 try{const value=JSON.parse(raw);return value&&typeof value==='object'?
   value:null;}catch{return null;}
}
async function existingQuote(env,analysis){
 const offers=await db(env,
    '/rest/v1/studio_quotes?select=id,project_id,owner_id,analysis_job_id,'+
    'quality,status,currency,amount_minor,estimate_version,expires_at'+
    '&analysis_job_id=eq.'+analysis.id+'&owner_id=eq.'+analysis.owner_id+
    '&project_id=eq.'+analysis.project_id+'&status=eq.quoted&limit=1');
 return presentVerifiedQuote(offers?.[0],analysis,true);
}
/**
 * Optional server-only issuer for audited, executable text-only production.
 * ALL gates are false by default. The existing eight-second PREVIEW cannot
 * silently be represented as a commercial video-production service.
 */
export async function issueAuditedQuote(env,analysis){
 if(env.STUDIO_VERIFIED_QUOTING_ENABLED!=='true'||
    env.STUDIO_AUTO_QUOTE_V1_ENABLED!=='true'||
    env.STUDIO_COMMERCIAL_QUOTING_APPROVED!=='true')return null;
 const rateCard=privateJSON(env,'STUDIO_PRICING_RATE_CARD_JSON');
 const capabilities=privateJSON(env,'STUDIO_VERIFIED_CAPABILITY_PLANS_JSON');
 if(!rateCard||!capabilities||
    typeof rateCard.version!=='string'||rateCard.version.length<1||
    !rateCard.business||rateCard.business.minimumSaleUSD!==1)return null;
 const projects=await db(env,'/rest/v1/studio_projects?select=id,reference_url,selected_style'+
    '&id=eq.'+analysis.project_id+'&owner_id=eq.'+analysis.owner_id+'&limit=1');
 const project=projects?.[0];
 if(!project)return null;
 const assets=await db(env,'/rest/v1/studio_assets?select=id'+
    '&project_id=eq.'+analysis.project_id+'&owner_id=eq.'+analysis.owner_id+
    '&status=neq.deleted&limit=1');
 const style=project.selected_style;
 const plan=buildVerifiedProductionPlan(analysis,capabilities,{
    hasAssets:Array.isArray(assets)&&assets.length>0,
    hasReference:Boolean(project.reference_url),
    hasStyle:Boolean(style&&typeof style==='object'&&Object.keys(style).length)
 });
 if(!plan)return null;
 let calculated;
 try{calculated=calculateStudioQuote(plan,rateCard);}catch{return null;}
 if(!Number.isFinite(calculated.customerPriceUSD)||
    calculated.customerPriceUSD<1||
    calculated.customerPriceUSD>10000)return null;
 const row={
   project_id:analysis.project_id,owner_id:analysis.owner_id,
   analysis_job_id:analysis.id,quality:analysis.quality,status:'quoted',
   currency:'USD',amount_minor:Math.round(calculated.customerPriceUSD*100),
   estimate_version:(rateCard.version+':'+plan.capabilityRevision).slice(0,160),
   expires_at:new Date(Date.now()+30*60*1000).toISOString(),
   customer_breakdown:[]
 };
 // A unique analysis_job_id index prevents multiple offers for concurrent
 // lookups. On conflict, read the winner rather than issuing a second quote.
 try{
   const inserted=await db(env,'/rest/v1/studio_quotes','POST',row);
   return presentVerifiedQuote(inserted?.[0],analysis,true);
 }catch{
   return existingQuote(env,analysis);
 }
}
export async function onRequestPost({request,env}){
 if(!ready(env))return fail(503,'Private quote lookup is unavailable');
 const size=Number(request.headers.get('content-length')||0);
 if(size>1024)return fail(413,'Request too large');
 try{
  const owner=await identifyOwner(request,env);
  if(!owner)return fail(401,'Sign in required');
  const raw=await request.text();
  if(raw.length>1024)return fail(413,'Request too large');
  let payload;
  try{payload=JSON.parse(raw)}catch{return fail(400,'Invalid JSON')}
  if(!validId(payload?.project_id)||!validId(payload?.analysis_id)||
     Object.keys(payload).length!==2)return fail(400,'Invalid quote request');
  const rows=await db(env,
   '/rest/v1/studio_ai_analysis_jobs?select=id,owner_id,project_id,quality,status,'+
   'analysis,input_tokens,output_tokens'+
   '&id=eq.'+payload.analysis_id+'&owner_id=eq.'+owner+
   '&project_id=eq.'+payload.project_id+'&limit=1');
  const analysis=rows?.[0];
  if(!analysis)return fail(404,'Request not found');
  if(!QUALITY.includes(analysis.quality))return fail(409,'Invalid request quality');
  if(analysis.status!=='completed')
    return reply({status:analysis.status==='failed'?'unavailable':'analyzing'});
  if(env.STUDIO_VERIFIED_QUOTING_ENABLED!=='true')
    return reply({status:'pending_verification',message:PENDING_MESSAGE});
  const saved=await existingQuote(env,analysis);
  if(saved)return reply(saved);
  const issued=await issueAuditedQuote(env,analysis);
  return reply(issued||{status:'pending_verification',message:PENDING_MESSAGE});
 }catch(e){return errorResponse(e)}
}
