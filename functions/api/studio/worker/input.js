// Server-only, single job-scoped R2 input. Never accept arbitrary R2 keys or URLs.
import {ready,authorize,db,active,reply,fail,errorResponse,validId,bucket} from '../../../_lib/studio-oracle.js';
export async function onRequestGet({request,env}){
 if(!ready(env))return fail(503,'Private rendering is disabled');
 if(!authorize(request,env))return fail(401,'Unauthorized');
 try{
  const u=new URL(request.url);
  const id=u.searchParams.get('job_id'),lease=u.searchParams.get('lease'),assetId=u.searchParams.get('asset_id');
  if(!validId(assetId))return fail(400,'Invalid asset');
  const job=await active(env,id,lease);if(!job)return fail(409,'Inactive job');
  const rows=await db(env,'/rest/v1/studio_assets?select=id,storage_path,byte_size,media_type,status,storage_provider'+
    '&project_id=eq.'+job.project_id+'&owner_id=eq.'+job.owner_id+
    '&id=eq.'+assetId+'&limit=1');
  const asset=rows?.[0];
  if(!asset||asset.status!=='ready'||asset.storage_provider!=='r2'||
    !asset.storage_path.startsWith(job.owner_id+'/'+job.project_id+'/r2/')||
    asset.byte_size>15000000)return fail(404,'Source media unavailable');
  const object=await bucket(env).get(asset.storage_path);
  if(!object||object.size!==Number(asset.byte_size))return fail(404,'Source media unavailable');
  return new Response(object.body,{status:200,headers:{
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
   'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="input.bin"'
  }});
 }catch(e){return errorResponse(e)}
}
