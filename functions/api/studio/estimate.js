// Customer-facing quote lookup. Internal AI classifications, provider costs,
// margin and tokens must NEVER enter this response or the browser.
// This route NEVER creates a payable invoice, initiates checkout, or renders.
import {ready,db,reply,fail,validId,errorResponse} from '../../_lib/studio-oracle.js';

const DB='https://gthwpfscrewwamjxheyj.supabase.co';
const QUALITY=['normal','semi_professional','professional'];
const PENDING_MESSAGE='We need to verify the production method, licensed footage, music and rendering costs before confirming your price. No payment is required.';

async function identifyOwner(request,env){
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{30,8192}$/.test(authorization))
   return null;
 const result=await fetch(DB+'/auth/v1/user',{
  method:'GET',
  headers:{Authorization:authorization,
    apikey:env.STUDIO_SUPABASE_SERVICE_ROLE_JWT},
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
    row.amount_minor<=0||row.amount_minor>100000000||
    !row.expires_at||Date.parse(row.expires_at)<=Date.now()||
    typeof row.estimate_version!=='string'||!row.estimate_version)
   return null;
 return {
   status:'quoted',quality:row.quality,currency:'USD',
   amount: (row.amount_minor/100).toFixed(2),
   expiresAt:row.expires_at,
   // No public checkout exists yet; approval and payment remain unavailable.
   paymentReady:false
 };
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
   '/rest/v1/studio_ai_analysis_jobs?select=id,owner_id,project_id,quality,status'+
   '&id=eq.'+payload.analysis_id+'&owner_id=eq.'+owner+
   '&project_id=eq.'+payload.project_id+'&limit=1');
  const analysis=rows?.[0];
  if(!analysis)return fail(404,'Request not found');
  if(!QUALITY.includes(analysis.quality))return fail(409,'Invalid request quality');
  if(analysis.status!=='completed')
    return reply({status:analysis.status==='failed'?'unavailable':'analyzing'});
  if(env.STUDIO_VERIFIED_QUOTING_ENABLED!=='true')
    return reply({status:'pending_verification',message:PENDING_MESSAGE});
  const offers=await db(env,
    '/rest/v1/studio_quotes?select=id,project_id,owner_id,analysis_job_id,'+
    'quality,status,currency,amount_minor,estimate_version,expires_at'+
    '&analysis_job_id=eq.'+analysis.id+'&owner_id=eq.'+owner+
    '&project_id=eq.'+analysis.project_id+'&status=eq.quoted&limit=1');
  const publicQuote=presentVerifiedQuote(offers?.[0],analysis,true);
  return reply(publicQuote||{status:'pending_verification',message:PENDING_MESSAGE});
 }catch(e){return errorResponse(e)}
}
