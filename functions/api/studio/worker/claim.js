// Worker-to-website queue only; never called by a browser or public user.
import {ready,authorize,db,reply,fail,errorResponse,validId} from '../../../_lib/studio-oracle.js';
export async function onRequestPost({request,env}){
 if(!ready(env))return fail(503,'Private rendering is disabled');
 if(!authorize(request,env))return fail(401,'Unauthorized');
 try{
  if(Number(request.headers.get('content-length')||0)>2048)return fail(413,'Request too large');
  const data=await request.json();
  if(data?.op==='claim'){
   const job=await db(env,'/rest/v1/rpc/studio_worker_claim','POST',{});
   return reply({job:job||null});
  }
  if(!validId(data?.job_id)||!validId(data?.lease))return fail(400,'Invalid job');
  if(data.op==='renew'){
   const ok=await db(env,'/rest/v1/rpc/studio_worker_renew','POST',{p_job:data.job_id,p_lease:data.lease});
   return reply({ok:ok===true});
  }
  if(data.op==='fail'){
   if(!['render_failed','input_unavailable','output_failed','timeout'].includes(data.code))
     return fail(400,'Invalid error code');
   const ok=await db(env,'/rest/v1/rpc/studio_worker_fail','POST',{
     p_job:data.job_id,p_lease:data.lease,p_code:data.code});
   return reply({ok:ok===true});
  }
  return fail(400,'Unsupported operation');
 }catch(e){return errorResponse(e)}
}
