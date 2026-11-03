// MAH GPT Studio private R2 retention collector.
// Runs on Cloudflare Cron even while the founder's PC is off.
// No public user handler. All privileged credentials are Worker secrets.
const BASE='https://gthwpfscrewwamjxheyj.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PER_RUN=20;
const MAX_ASSETS=500;

async function requestJson(path,{key,fetchImpl,method='GET',body}){
  const response=await fetchImpl(BASE+'/rest/v1/'+path,{
    method,headers:{
      apikey:key,
      Accept:'application/json',
      ...(body===undefined?{}:{'Content-Type':'application/json'})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:'no-store'
  });
  const result=await response.text();
  if(!response.ok)throw new Error('Retention database request failed ('+response.status+')');
  if(!result.trim())return null;
  try{return JSON.parse(result)}catch{throw Error('Invalid retention database response')}
}
function validKey(item,projectId){
  if(item.storage_provider!=='r2')throw Error('Non-R2 assets require separate cleanup');
  if(!UUID.test(item.id)||!UUID.test(item.owner_id)||item.project_id!==projectId)throw Error('Invalid asset identifier');
  const expected=item.owner_id+'/'+projectId+'/r2/'+item.id+'/';
  // A namespace check prevents a corrupted record from deleting other users' objects.
  if(typeof item.storage_path!=='string'||!item.storage_path.startsWith(expected)||item.storage_path.length>700)
    throw Error('Unexpected private R2 asset path');
  return item.storage_path;
}
export async function runRetention(env,{fetchImpl=fetch,log=console}={}){
  if(env?.STUDIO_RETENTION_ENABLED!=='true')return {enabled:false,processed:0};
  const key=env?.SUPABASE_RETENTION_SECRET_KEY;
  if(!key||!/^sb_secret_[A-Za-z0-9_-]+$/.test(key))
    throw Error('Dedicated server-only Supabase secret key missing');
  const bucket=env?.STUDIO_MEDIA;
  if(!bucket||typeof bucket.delete!=='function')throw Error('Private R2 binding missing');
  let processed=0,failed=0;
  for(let i=0;i<MAX_PER_RUN;i++){
    const id=await requestJson('rpc/studio_gc_claim_next',{key,fetchImpl,method:'POST',body:{}});
    if(id===null)break;
    if(!UUID.test(id))throw Error('Untrusted cleanup project id');
    try{
      const assets=await requestJson('studio_assets?select=id,owner_id,project_id,storage_provider,storage_path,status&project_id=eq.'+id+'&limit='+(MAX_ASSETS+1),{key,fetchImpl});
      if(!Array.isArray(assets)||assets.length>MAX_ASSETS)throw Error('Project exceeds safe per-run asset cap');
      // Verify *all* paths before deleting *any* objects.
      const paths=assets.map(a=>validKey(a,id));
      for(const path of paths)await bucket.delete(path); // idempotent, safe to retry
      const finished=await requestJson('rpc/studio_gc_finish',{key,fetchImpl,method:'POST',body:{p_project:id}});
      if(finished!==true)throw Error('Could not finalize cleanup after removing objects');
      processed++;
    }catch(error){
      failed++;
      // The project remains in 'deleting'. Next scheduled run retries safely.
      log.error('Studio retention incomplete: '+String(error?.message||error));
    }
  }
  return {enabled:true,processed,failed};
}
export default {
  async scheduled(_controller,env,ctx){
    const task=runRetention(env);
    ctx.waitUntil(task);
  },
  async fetch(){
    return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
  }
};
