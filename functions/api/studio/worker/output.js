// Commit a bounded MP4 only after R2 confirms the object size. DB finish is transactional.
import {ready,authorize,db,active,reply,fail,errorResponse,bucket} from '../../../_lib/studio-oracle.js';
const LIMIT=20000000;
export async function onRequestPost({request,env}){
 if(!ready(env))return fail(503,'Private rendering is disabled');
 if(!authorize(request,env))return fail(401,'Unauthorized');
 const size=Number(request.headers.get('content-length'));
 if(!Number.isSafeInteger(size)||size<1000||size>LIMIT)return fail(413,'Invalid output size');
 if(request.headers.get('content-type')!=='video/mp4')return fail(415,'MP4 required');
 let key=null,stored=false;
 try{
  const id=request.headers.get('x-job-id'),lease=request.headers.get('x-job-lease');
  const job=await active(env,id,lease);if(!job)return fail(409,'Inactive job');
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.byteLength!==size||bytes.byteLength>LIMIT||
    String.fromCharCode(...bytes.slice(4,8))!=='ftyp')return fail(415,'Invalid MP4');
  key=job.owner_id+'/'+job.project_id+'/r2/render/'+job.id+'/final.mp4';
  await bucket(env).put(key,bytes,{httpMetadata:{contentType:'video/mp4'},
    customMetadata:{studio:'oracle-private-preview',job_id:job.id}});
  stored=true;
  const checked=await bucket(env).head(key);
  if(!checked||checked.size!==bytes.byteLength)throw Error('R2 output verification failed');
  const ok=await db(env,'/rest/v1/rpc/studio_worker_finish','POST',{
    p_job:job.id,p_lease:lease,p_bytes:bytes.byteLength
  });
  if(ok!==true)throw Error('Output transaction rejected');
  return reply({ok:true,completed:true},201);
 }catch(e){
  if(stored&&key)try{await bucket(env).delete(key)}catch(err){console.error('R2 cleanup required:',String(err))}
  return errorResponse(e);
 }
}
