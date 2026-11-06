// Oracle outbound-only AI analysis bridge (text-only, founder-only RLS).
// Completely independent of the existing preview render queue and R2 files.
// No OpenAI credential is ever sent through this route.
import {
 ready,authorize,db,reply,fail,errorResponse,validId
} from '../../../_lib/studio-oracle.js';

const COMPLEXITIES=['simple','moderate','advanced','specialist_3d'];
const METHODS=['ffmpeg_text_motion','template_motion_graphics',
 'custom_2d_animation','specialist_3d','generative_media_required'];
export function validateAnalysisResult(a){
 if(!a||typeof a!=='object'||Array.isArray(a))return false;
 const keys=Object.keys(a).sort();
 if(keys.join('|')!==['complexity','estimatedDurationSeconds','needsReview',
   'needsVoiceover','productionApproach','summary'].sort().join('|'))return false;
 return COMPLEXITIES.includes(a.complexity)&&
   METHODS.includes(a.productionApproach)&&
   Number.isSafeInteger(a.estimatedDurationSeconds)&&
   a.estimatedDurationSeconds>=1&&a.estimatedDurationSeconds<=600&&
   typeof a.needsReview==='boolean'&&typeof a.needsVoiceover==='boolean'&&
   typeof a.summary==='string'&&a.summary.length<=600;
}
export async function onRequestPost({request,env}){
 if(!ready(env))return fail(503,'Private analysis is disabled');
 if(!authorize(request,env))return fail(401,'Unauthorized');
 try{
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>4096)return fail(413,'Analysis envelope too large');
  const raw=await request.text();
  if(raw.length>4096)return fail(413,'Analysis envelope too large');
  let data;
  try{data=JSON.parse(raw)}catch{return fail(400,'Invalid JSON')}
  if(data?.op==='claim'){
   if(Object.keys(data).length!==1)return fail(400,'Invalid claim envelope');
   const job=await db(env,'/rest/v1/rpc/studio_ai_worker_claim','POST',{});
   return reply({job:job||null});
  }
  if(!validId(data?.job_id)||!validId(data?.lease))
   return fail(400,'Invalid analysis lease');
  if(data.op==='finish'){
   if(!validateAnalysisResult(data.analysis)||
       !Number.isSafeInteger(data.input_tokens)||data.input_tokens<1||
         data.input_tokens>4000||
       !Number.isSafeInteger(data.output_tokens)||data.output_tokens<1||
         data.output_tokens>900||
       typeof data.cost_usd!=='number'||!Number.isFinite(data.cost_usd)||
         data.cost_usd<0||data.cost_usd>0.002)
     return fail(400,'Invalid analysis result');
   const ok=await db(env,'/rest/v1/rpc/studio_ai_worker_finish','POST',{
      p_job:data.job_id,p_lease:data.lease,
      p_analysis:data.analysis,p_input_tokens:data.input_tokens,
      p_output_tokens:data.output_tokens,p_cost_usd:data.cost_usd
   });
   return reply({ok:ok===true},ok===true?200:409);
  }
  if(data.op==='fail'){
   if(!['analysis_failed','api_unavailable','budget_limit','timeout'].includes(data.code))
     return fail(400,'Invalid error code');
   const ok=await db(env,'/rest/v1/rpc/studio_ai_worker_fail','POST',{
     p_job:data.job_id,p_lease:data.lease,p_code:data.code
   });
   return reply({ok:ok===true},ok===true?200:409);
  }
  return fail(400,'Unsupported operation');
 }catch(e){return errorResponse(e)}
}
