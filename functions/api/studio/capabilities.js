// Read-only, authenticated discovery bridge from MAH GPT website to the COMPLETE Studio engine.
// Deliberately disabled until a verified cloud engine and private runtime keys are configured.
// Never forwards user JWTs to the engine or exposes the engine's internal secret.
const noStore = {
  "Cache-Control":"no-store",
  "Content-Type":"application/json; charset=utf-8",
  "X-Content-Type-Options":"nosniff",
};
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:noStore});}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/i;
const CAP_ID=/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const sha=/^[a-f0-9]{40}$/;
function configured(env){
 if(env?.STUDIO_CLOUD_GATEWAY_ENABLED!=="true")return false;
 return Boolean(env.STUDIO_SUPABASE_URL&&env.STUDIO_SUPABASE_PUBLISHABLE_KEY&&
   env.STUDIO_ENGINE_INTERNAL_URL&&env.STUDIO_ENGINE_INTERNAL_TOKEN);
}
export async function onRequestGet({request,env}, {fetchImpl=fetch}={}){
 if(!configured(env))return json({connected:false,reason:"Cloud Studio is not connected yet"},503);
 const bearer=request.headers.get("Authorization")||"";
 if(!/^Bearer [A-Za-z0-9._-]{20,}$/.test(bearer))
  return json({error:"Sign in to access Studio capabilities"},401);
 try{
  const base=new URL(env.STUDIO_SUPABASE_URL);
  const internal=new URL(env.STUDIO_ENGINE_INTERNAL_URL);
  if(base.protocol!=="https:"||internal.protocol!=="https:"||
     base.username||base.password||internal.username||internal.password||
     internal.search||internal.hash||internal.pathname!=="/")
    return json({connected:false,reason:"Cloud Studio configuration is invalid"},503);
  const session=await fetchImpl(new URL("/auth/v1/user",base).toString(),{
    headers:{apikey:env.STUDIO_SUPABASE_PUBLISHABLE_KEY,Authorization:bearer},
    cache:"no-store",signal:AbortSignal.timeout(5000)
  });
  if(!session.ok)return json({error:"Session expired or invalid"},401);
  const user=await session.json();
  if(!UUID.test(user?.id||""))return json({error:"Invalid session"},401);
  const target=new URL("/v1/capabilities",internal);
  const remote=await fetchImpl(target.toString(),{
    headers:{Authorization:"Bearer "+env.STUDIO_ENGINE_INTERNAL_TOKEN,
      Accept:"application/json"},
    cache:"no-store",signal:AbortSignal.timeout(5000)
  });
  if(!remote.ok)return json({connected:false,reason:"Cloud Studio is unavailable"},503);
  const source=await remote.json();
  if(source?.protocolVersion!==1||!Array.isArray(source?.capabilities)||
     source.capabilities.length>100||!sha.test(source?.engineRevision||""))
    return json({connected:false,reason:"Cloud Studio version is not compatible"},503);
  const capabilities=[];
  for(const c of source.capabilities){
    if(!CAP_ID.test(c?.id||"")||typeof c?.label!=="string"||c.label.length>120||
      typeof c.family!=="string"||c.family.length>60||typeof c.cloudReady!=="boolean")
      return json({connected:false,reason:"Cloud Studio capability catalog is invalid"},503);
    capabilities.push({id:c.id,label:c.label,family:c.family,cloudReady:c.cloudReady});
  }
  return json({connected:true,protocolVersion:1,engineRevision:source.engineRevision,
    jobCreationEnabled:false,capabilities}); // Jobs remain disabled in this website.
 }catch{
  return json({connected:false,reason:"Cloud Studio is temporarily unavailable"},503);
 }
}
