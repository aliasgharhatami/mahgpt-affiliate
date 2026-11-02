// Authenticated Cloudflare Pages / R2 media pilot – no service-role keys.
// Private founder-only pilot, 15 MB per file, 80 MB lifetime account quota.
// R2 content is NEVER publicly accessible. Production public uploads remain off.
const SB_URL='https://gthwpfscrewwamjxheyj.supabase.co';
const SB_KEY='sb_publishable_7QQCrCTCZ_-rBPKIWc0qVg_cu2lAaoD'; // Public Supabase publishable key (already in client config).
const MAX_BYTES=15000000;
const MIME=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
 'audio/mpeg','audio/wav','audio/x-wav','audio/mp4']);
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const common={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...common,'Content-Type':'application/json; charset=utf-8'}})}
function failure(status,message){return json({error:message},status)}
function dbHeaders(token,extra={}){return {'apikey':SB_KEY,'Authorization':'Bearer '+token,...extra}}
async function supa(token,path,options={}){
 const r=await fetch(SB_URL+path,{...options,headers:dbHeaders(token,options.headers||{}),cache:'no-store'});
 let data=null;try{data=await r.json()}catch{}
 if(!r.ok)throw Object.assign(new Error(data?.message||data?.error||'Database request failed'),{status:r.status});
 return data;
}
async function authenticate(request){
 const header=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{20,}$/.test(header))throw Object.assign(new Error('Sign in to continue'),{status:401});
 const token=header.slice(7);
 const r=await fetch(SB_URL+'/auth/v1/user',{headers:dbHeaders(token),cache:'no-store'});
 if(!r.ok)throw Object.assign(new Error('Your sign-in session has expired'),{status:401});
 const user=await r.json();
 if(!user?.id||!ID.test(user.id))throw Object.assign(new Error('Account could not be verified'),{status:401});
 return {token,user};
}
async function pilot(token,user){
 const rows=await supa(token,'/rest/v1/studio_media_testers?select=user_id,consumed_lifetime_bytes,uploads_reserved&user_id=eq.'+user.id+'&limit=1');
 return Array.isArray(rows)&&rows.length?rows[0]:null;
}
async function project(token,projectId){
 if(!ID.test(projectId||''))throw Object.assign(new Error('Invalid project ID'),{status:400});
 const rows=await supa(token,'/rest/v1/studio_projects?select=id&id=eq.'+projectId+'&limit=1');
 if(!Array.isArray(rows)||rows.length!==1)throw Object.assign(new Error('Project not found'),{status:404});
 return rows[0];
}
async function rpc(token,name,payload){
 return supa(token,'/rest/v1/rpc/'+name,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
 });
}
async function asset(token,projectId,assetId){
 if(!ID.test(assetId||''))throw Object.assign(new Error('Invalid file ID'),{status:400});
 const rows=await supa(token,
 '/rest/v1/studio_assets?select=id,project_id,filename,media_type,byte_size,storage_path,status,storage_provider&project_id=eq.'+projectId+
 '&id=eq.'+assetId+'&storage_provider=eq.r2&limit=1');
 if(!Array.isArray(rows)||rows.length!==1)throw Object.assign(new Error('File not found'),{status:404});
 return rows[0];
}
function looksLike(bytes,mime){
 const match=(start,arr)=>arr.every((v,i)=>bytes[start+i]===v);
 if(bytes.length<16)return false;
 if(mime==='image/png')return match(0,[137,80,78,71,13,10,26,10]);
 if(mime==='image/jpeg')return match(0,[255,216,255]);
 if(mime==='image/webp')return match(0,[82,73,70,70])&&match(8,[87,69,66,80]);
 if(mime==='video/webm')return match(0,[26,69,223,163]);
 if(mime==='audio/wav'||mime==='audio/x-wav')return match(0,[82,73,70,70])&&match(8,[87,65,86,69]);
 if(mime==='audio/mpeg')return match(0,[73,68,51])||(bytes[0]===255&&(bytes[1]&224)===224);
 if(['video/mp4','video/quicktime','audio/mp4'].includes(mime))return match(4,[102,116,121,112]);
 return false;
}
function requireBucket(context){
 const b=context.env?.STUDIO_MEDIA;
 if(!b||typeof b.get!=='function'||typeof b.put!=='function'||typeof b.delete!=='function')
  throw Object.assign(new Error('Private file storage is temporarily unavailable'),{status:503});
 return b;
}
async function ctx(request,context){
 const auth=await authenticate(request);
 const approved=await pilot(auth.token,auth.user);
 return {...auth,approved,bucket: context.env?.STUDIO_MEDIA};
}
function publicAsset(a){return {id:a.id,filename:a.filename,media_type:a.media_type,byte_size:a.byte_size,
 status:a.status,created_at:a.created_at,uploaded_at:a.uploaded_at}}
function handleError(error){
 const status=Number(error?.status)||500;
 if(status>=500)console.error('Studio media API:',String(error?.message||error));
 return failure(status>=400&&status<500?status:503,
  status>=400&&status<500?error.message:'Media service unavailable. Try again later.');
}
export async function onRequestGet(context){
 try{
  const {request}=context;
  const {token,user,approved}=await ctx(request,context);
  if(!approved)return json({pilot:false,uploads_enabled:false,files:[]});
  const url=new URL(request.url);
  const projectId=url.searchParams.get('project_id');
  await project(token,projectId);
  const assetId=url.searchParams.get('asset_id');
  if(assetId){
   const a=await asset(token,projectId,assetId);
   if(a.status!=='ready')return failure(404,'File is not available');
   const bucket=requireBucket(context);
   const object=await bucket.get(a.storage_path);
   if(!object)return failure(404,'File no longer exists in storage');
   // No inline rendering of customer content; protect origin from embedded HTML/SVG.
   const escaped=encodeURIComponent(a.filename||'media');
   return new Response(object.body,{status:200,headers:{
     ...common,'Content-Type':'application/octet-stream',
     'Content-Disposition':"attachment; filename*=UTF-8''"+escaped,
     'X-Content-Type-Options':'nosniff'
   }});
  }
  const files=await supa(token,'/rest/v1/studio_assets?select=id,filename,media_type,byte_size,status,created_at,uploaded_at'+
    '&project_id=eq.'+projectId+'&storage_provider=eq.r2&status=eq.ready&order=created_at.desc&limit=50');
  return json({pilot:true,uploads_enabled:true,limit_file_bytes:MAX_BYTES,
    consumed_lifetime_bytes:Number(approved.consumed_lifetime_bytes),
    limit_lifetime_bytes:80000000,files:(files||[]).map(publicAsset)});
 }catch(e){return handleError(e)}
}
export async function onRequestPost(context){
 let storageKey=null,assetId=null,auth=null,uploaded=false;
 try{
  const {request}=context;
  auth=await ctx(request,context);
  if(!auth.approved)return failure(403,'Media uploads are in private testing only');
  const bucket=requireBucket(context);
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_BYTES+50000)return failure(413,'File exceeds the 15 MB private test limit');
  const type=request.headers.get('content-type')||'';
  if(!type.toLowerCase().startsWith('multipart/form-data;'))return failure(415,'Expected a file upload form');
  const form=await request.formData();
  const file=form.get('file'),projectId=String(form.get('project_id')||'');
  if(!file||typeof file.arrayBuffer!=='function')return failure(400,'Choose a file to upload');
  if(!ID.test(projectId))return failure(400,'Invalid project ID');
  if(form.get('rights_confirmed')!=='true')return failure(400,'Confirm you own the files or have permission to upload them');
  await project(auth.token,projectId);
  const mime=String(file.type||'').toLowerCase().trim();
  const filename=String(file.name||'').replace(/[\r\n]/g,'').slice(0,255);
  if(!MIME.has(mime))return failure(415,'Only JPG, PNG, WebP, MP4, MOV, WebM, MP3, WAV and M4A are supported');
  if(file.size<100||file.size>MAX_BYTES)return failure(413,'Pilot files must be 100 bytes–15 MB');
  if(!filename)return failure(400,'File has no name');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength!==file.size||!looksLike(bytes,mime))return failure(415,'File format does not match its declared type');
  const reservation=await rpc(auth.token,'studio_beta_reserve_asset',{
   p_project:projectId,p_filename:filename,p_mime:mime,p_size:bytes.byteLength,p_rights_confirmed:true
  });
  const row=reservation?.[0];
  if(!row?.asset_id||!row?.storage_key)throw new Error('Upload reservation could not be confirmed');
  assetId=row.asset_id;storageKey=row.storage_key;
  if(await rpc(auth.token,'studio_beta_set_asset_status',{p_asset:assetId,p_next:'uploading'})!==true)
   throw new Error('Unable to start secure upload');
  await bucket.put(storageKey,bytes.buffer,{httpMetadata:{contentType:mime},customMetadata:{studio:'private-pilot'}});
  uploaded=true;
  if(await rpc(auth.token,'studio_beta_set_asset_status',{p_asset:assetId,p_next:'ready'})!==true)
   throw new Error('Unable to confirm uploaded file');
  return json({ok:true,id:assetId,filename,size:bytes.byteLength},201);
 }catch(e){
  if(storageKey&&auth?.approved){
   try{if(uploaded)await context.env.STUDIO_MEDIA.delete(storageKey)}catch(cleanupErr){console.error('Media cleanup failed:',cleanupErr)}
   try{await rpc(auth.token,'studio_beta_set_asset_status',{p_asset:assetId,p_next:'deleted'})}catch(cleanupErr){console.error('Metadata cleanup failed:',cleanupErr)}
  }
  return handleError(e);
 }
}
export async function onRequestDelete(context){
 try{
  const {request}=context;
  const {token,approved}=await ctx(request,context);
  if(!approved)return failure(403,'Private media pilot only');
  const bucket=requireBucket(context);
  const data=await request.json();
  const projectId=String(data?.project_id||''), assetId=String(data?.asset_id||'');
  await project(token,projectId);
  const a=await asset(token,projectId,assetId);
  if(a.status!=='deleted') {
   await bucket.delete(a.storage_path);
   const done=await rpc(token,'studio_beta_set_asset_status',{p_asset:a.id,p_next:'deleted'});
   if(done!==true)throw new Error('Could not finalize file deletion');
  }
  return json({ok:true,deleted:true});
 }catch(e){return handleError(e)}
}
