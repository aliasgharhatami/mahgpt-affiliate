// Shared private Oracle render bridge. Never import this file into browser code.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const DB='https://gthwpfscrewwamjxheyj.supabase.co';
const shared={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export const validId=x=>typeof x==='string'&&UUID.test(x);
export const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...shared,'Content-Type':'application/json; charset=utf-8'}});
export const fail=(status,error)=>reply({error},status);
export function ready(env){
 return env?.STUDIO_ORACLE_PILOT_ENABLED==='true'&&
  typeof env.STUDIO_ORACLE_WORKER_TOKEN==='string'&&env.STUDIO_ORACLE_WORKER_TOKEN.length>=40&&
  typeof env.STUDIO_SUPABASE_SERVICE_ROLE_JWT==='string'&&env.STUDIO_SUPABASE_SERVICE_ROLE_JWT.length>=40&&
  env.STUDIO_MEDIA&&typeof env.STUDIO_MEDIA.get==='function'&&typeof env.STUDIO_MEDIA.put==='function';
}
export function authorize(request,env){
 const actual=request.headers.get('Authorization')||'';
 const expected='Bearer '+env.STUDIO_ORACLE_WORKER_TOKEN;
 // Constant work for equal-length strings; token is high entropy and restricted to server env.
 if(actual.length!==expected.length)return false;
 let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
export async function db(env,path,method='GET',body){
 const secret=env.STUDIO_SUPABASE_SERVICE_ROLE_JWT;
 const res=await fetch(DB+path,{method,headers:{
   apikey:secret,Authorization:'Bearer '+secret,
   ...(body===undefined?{}:{'Content-Type':'application/json'}),
   ...(method==='POST'?{Prefer:'return=representation'}:{})
  },body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',
  signal:AbortSignal.timeout(15000)});
 let data=null;try{data=await res.json()}catch{}
 if(!res.ok)throw Error('Private database operation failed ('+res.status+')');
 return data;
}
export async function active(env,id,lease){
 if(!validId(id)||!validId(lease))return null;
 const rows=await db(env,'/rest/v1/studio_render_jobs?select=id,owner_id,project_id,lease_token,lease_expires_at,status&id=eq.'+id+'&limit=1');
 const row=rows?.[0];
 if(row?.status!=='rendering'||row.lease_token!==lease||
  !row.lease_expires_at||Date.parse(row.lease_expires_at)<=Date.now())return null;
 return row;
}
export const bucket=env=>env.STUDIO_MEDIA;
export const errorResponse=(e)=>{
 console.error('Private Oracle rendering bridge:',String(e?.message||e).slice(0,180));
 return fail(503,'Private rendering temporarily unavailable');
};
