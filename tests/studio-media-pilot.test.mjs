import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {onRequestGet,onRequestPost,onRequestDelete} from '../functions/api/studio/media.js';

const USER='da468fce-d2aa-4322-a98c-4398d2acb1d0';
const PROJECT='40ab6851-2e09-438d-b4da-b23efebe28be';
const ASSET='43261020-440f-469a-a6fb-5c89ecd8d38d';
const TOKEN='Bearer testToken_ABCDEFGHIJKLMNOPQRSTUV0123456789';
const PATH=USER+'/'+PROJECT+'/r2/'+ASSET+'/test.mp4';
const savedFetch=globalThis.fetch;
const asJson=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
function setup({approved=true,projectOwned=true,assets=[],rpcResponse}={}){
 const calls={put:0,get:0,delete:0,reserve:0,mark:0};
 const store=new Map();
 const bucket={
  async put(key,value){calls.put++;store.set(key,value);return {}},
  async get(key){calls.get++;if(!store.has(key))return null;return {body:new Blob([store.get(key)]).stream()}},
  async delete(key){calls.delete++;store.delete(key)}
 };
 globalThis.fetch=async(url,opts={})=>{
  url=String(url);
  if(url.endsWith('/auth/v1/user'))return asJson({id:USER,email:'owner@example.test'});
  if(url.includes('/studio_media_testers?'))return asJson(approved?[{user_id:USER,consumed_lifetime_bytes:0,uploads_reserved:0}]:[]);
  if(url.includes('/studio_projects?'))return asJson(projectOwned?[{id:PROJECT}]:[]);
  if(url.includes('/studio_assets?')){
   const one=url.includes('id=eq.'+ASSET);
   return asJson(one?assets.slice(0,1):assets);
  }
  if(url.includes('/rpc/studio_beta_reserve_asset')){calls.reserve++;return asJson(rpcResponse||[{asset_id:ASSET,storage_key:PATH}])}
  if(url.includes('/rpc/studio_beta_set_asset_status')){calls.mark++;return asJson(true)}
  return asJson({error:'Unexpected test endpoint'},500);
 };
 return {calls,bucket,store};
}
function fakeGet(url,bucket,withToken=true){
 return {request:new Request(url,{headers:withToken?{Authorization:TOKEN}:{}}),env:{STUDIO_MEDIA:bucket}};
}
function mp4File(size=260){
 const raw=new Uint8Array(size);raw.set([102,116,121,112],4);
 return new File([raw],'test.mp4',{type:'video/mp4'});
}
function fakeUpload(bucket,{file=mp4File(),rights=true}={}){
 const form=new FormData();
 form.append('project_id',PROJECT);
 form.append('rights_confirmed',rights?'true':'false');
 form.append('file',file,file.name);
 return {request:new Request('https://mahgpt.com/api/studio/media',{
  method:'POST',headers:{Authorization:TOKEN},body:form}),env:{STUDIO_MEDIA:bucket}};
}
test.afterEach(()=>{globalThis.fetch=savedFetch});
test('rejects anonymous requests without database or R2 access',async()=>{
 const {bucket,calls}=setup();
 const r=await onRequestGet(fakeGet('https://mahgpt.com/api/studio/media?project_id='+PROJECT,bucket,false));
 assert.equal(r.status,401);assert.equal(calls.get,0);
});
test('non pilot account cannot upload',async()=>{
 const {bucket,calls}=setup({approved:false});
 const r=await onRequestPost(fakeUpload(bucket));
 assert.equal(r.status,403);assert.equal(calls.put,0);assert.equal(calls.reserve,0);
});
test('non-owner cannot list project',async()=>{
 const {bucket,calls}=setup({projectOwned:false});
 const r=await onRequestGet(fakeGet('https://mahgpt.com/api/studio/media?project_id='+PROJECT,bucket));
 assert.equal(r.status,404);assert.equal(calls.get,0);
});
test('rejects missing rights acknowledgement',async()=>{
 const {bucket,calls}=setup();
 const r=await onRequestPost(fakeUpload(bucket,{rights:false}));
 assert.equal(r.status,400);assert.equal(calls.reserve,0);assert.equal(calls.put,0);
});
test('rejects oversized file before reserving any quota',async()=>{
 const {bucket,calls}=setup();
 const r=await onRequestPost(fakeUpload(bucket,{file:mp4File(15000001)}));
 assert.equal(r.status,413);assert.equal(calls.reserve,0);assert.equal(calls.put,0);
});
test('owner upload calls reserve, writes private object, marks ready',async()=>{
 const {bucket,calls,store}=setup();
 const r=await onRequestPost(fakeUpload(bucket));
 assert.equal(r.status,201);
 assert.equal((await r.json()).id,ASSET);
 assert.equal(calls.reserve,1);assert.equal(calls.put,1);assert.equal(calls.mark,2);
 assert.ok(store.has(PATH));
});
test('owner file can be downloaded privately and deleted',async()=>{
 const a={id:ASSET,project_id:PROJECT,filename:'test.mp4',media_type:'video/mp4',
 byte_size:260,storage_path:PATH,status:'ready',storage_provider:'r2'};
 const {bucket,calls,store}=setup({assets:[a]});
 store.set(PATH,new Uint8Array(260));
 const getUrl='https://mahgpt.com/api/studio/media?project_id='+PROJECT+'&asset_id='+ASSET;
 const downloaded=await onRequestGet(fakeGet(getUrl,bucket));
 assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('Content-Type'),'application/octet-stream');
 assert.equal((await downloaded.arrayBuffer()).byteLength,260);
 const req=new Request('https://mahgpt.com/api/studio/media',{method:'DELETE',headers:{
  Authorization:TOKEN,'Content-Type':'application/json'},body:JSON.stringify({project_id:PROJECT,asset_id:ASSET})});
 const del=await onRequestDelete({request:req,env:{STUDIO_MEDIA:bucket}});
 assert.equal(del.status,200);assert.equal(calls.delete,1);assert.equal(calls.mark,1);
 assert.equal(store.has(PATH),false);
});
