import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet} from "../functions/api/studio/capabilities.js";
const token="Bearer "+"x".repeat(45);
const environment={
  STUDIO_CLOUD_GATEWAY_ENABLED:"true",
  STUDIO_SUPABASE_URL:"https://example.supabase.co",
  STUDIO_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
  STUDIO_ENGINE_INTERNAL_URL:"https://studio-engine.example.com/",
  STUDIO_ENGINE_INTERNAL_TOKEN:"internal-test-token-only-12345678901234567890",
};
const UUID="f71fc3c6-bfa4-43bd-8b45-2a7fcd29780e";
function req(signed=true){return {request:new Request("https://mahgpt.com/api/studio/capabilities",{
 headers:signed?{Authorization:token}:{}}),env:{...environment}};}
const catalog={protocolVersion:1,engineRevision:"a".repeat(40),jobCreationEnabled:false,
 capabilities:[{id:"reference.style-analysis",label:"Style analysis",family:"analysis",cloudReady:false}]};
function stubFetch({validSession=true,upstream=catalog,upstreamStatus=200}={}){
 const urls=[];
 return {urls,run:async (url,opts)=>{
  urls.push({url,headers:opts.headers});
  if(url.endsWith("/auth/v1/user"))
    return new Response(JSON.stringify(validSession?{id:UUID}:{}),{status:validSession?200:401});
  if(url.endsWith("/v1/capabilities"))
    return new Response(JSON.stringify(upstream),{status:upstreamStatus});
  throw Error("Unexpected request");
 }};
}
test("fails closed without cloud deployment configuration",async()=>{
 const c=req();c.env.STUDIO_CLOUD_GATEWAY_ENABLED="false";
 const f=stubFetch();const out=await onRequestGet(c,{fetchImpl:f.run});
 assert.equal(out.status,503);assert.equal(f.urls.length,0);
});
test("does not reach Supabase or engine for anonymous users",async()=>{
 const f=stubFetch();const out=await onRequestGet(req(false),{fetchImpl:f.run});
 assert.equal(out.status,401);assert.equal(f.urls.length,0);
});
test("requires a valid Supabase session",async()=>{
 const f=stubFetch({validSession:false});
 const out=await onRequestGet(req(),{fetchImpl:f.run});
 assert.equal(out.status,401);assert.equal(f.urls.length,1);
});
test("proxies only an authenticated, compatible capability catalog",async()=>{
 const f=stubFetch();const out=await onRequestGet(req(),{fetchImpl:f.run});
 assert.equal(out.status,200);
 const body=await out.json();
 assert.equal(body.connected,true);assert.equal(body.jobCreationEnabled,false);
 assert.equal(body.capabilities[0].id,"reference.style-analysis");
 assert.equal(f.urls.length,2);
 assert.equal(f.urls[1].headers.Authorization,"Bearer "+environment.STUDIO_ENGINE_INTERNAL_TOKEN);
 assert.equal(JSON.stringify(body).includes(environment.STUDIO_ENGINE_INTERNAL_TOKEN),false);
});
test("rejects incompatible catalogs and does not offer unsupported jobs",async()=>{
 const f=stubFetch({upstream:{...catalog,protocolVersion:7}});
 const out=await onRequestGet(req(),{fetchImpl:f.run});
 assert.equal(out.status,503);
});
test("refuses non-HTTPS internal engine URLs",async()=>{
 const c=req();c.env.STUDIO_ENGINE_INTERNAL_URL="http://127.0.0.1:8080";
 const f=stubFetch();const out=await onRequestGet(c,{fetchImpl:f.run});
 assert.equal(out.status,503);assert.equal(f.urls.length,0);
});
