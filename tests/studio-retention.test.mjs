import test from 'node:test';
import assert from 'node:assert/strict';
import {runRetention} from '../workers/studio-retention/src/worker.mjs';

const project='e7d012a6-5098-42ba-9b12-8b2e4450ab60';
const owner='84d3be5e-0dbe-4825-80df-e41f07f76d7b';
const asset='2794cc84-7517-4c1a-94d5-c6f9f90c29fa';
const path=owner+'/'+project+'/r2/'+asset+'/sample.png';
const base={
 STUDIO_RETENTION_ENABLED:'true',
 SUPABASE_RETENTION_SECRET_KEY:'sb_secret_test_ABCDEFGHIJKLMNOPQRST'
};
const record={id:asset,owner_id:owner,project_id:project,storage_provider:'r2',storage_path:path,status:'ready'};
function envFor({assets=[record],deletionFails=false,badPath=false}={}){
 const actions=[],claims=[project,null];let stored=[...(assets.map(a=>badPath?{...a,storage_path:'other-person/file'}:a))];
 const env={...base,STUDIO_MEDIA:{async delete(k){actions.push(['R2.delete',k]);if(deletionFails)throw Error('R2 test outage')}}};
 const fetchImpl=async (url,opts)=>{
  const route=String(url).split('/rest/v1/')[1];
  if(route==='rpc/studio_gc_claim_next'){actions.push(['RPC.claim']);return new Response(JSON.stringify(claims.shift()??null))}
  if(route.startsWith('studio_assets?')){actions.push(['DB.assets']);return new Response(JSON.stringify(stored))}
  if(route==='rpc/studio_gc_finish'){actions.push(['RPC.finish']);return new Response('true')}
  throw Error('Unexpected remote API '+route);
 };
 return {env,fetchImpl,actions};
}
const quiet={error(){}};
test('keeps cleanup disabled by default, including with valid database keys',async()=>{
 const {env,fetchImpl,actions}=envFor();
 env.STUDIO_RETENTION_ENABLED='false';
 assert.deepEqual(await runRetention(env,{fetchImpl,log:quiet}),{enabled:false,processed:0});
 assert.equal(actions.length,0);
});
test('requires a dedicated Supabase secret and a private bucket before claiming',async()=>{
 const {env,fetchImpl,actions}=envFor();delete env.SUPABASE_RETENTION_SECRET_KEY;
 await assert.rejects(()=>runRetention(env,{fetchImpl}),/secret key missing/);
 assert.equal(actions.length,0);
});
test('deletes R2 keys before deleting a project record',async()=>{
 const {env,fetchImpl,actions}=envFor();
 assert.deepEqual(await runRetention(env,{fetchImpl,log:quiet}),{enabled:true,processed:1,failed:0});
 const order=actions.map(a=>a[0]);
 assert.deepEqual(order,['RPC.claim','DB.assets','R2.delete','RPC.finish','RPC.claim']);
});
test('failed R2 deletion never finalizes the project; scheduled retry is safe',async()=>{
 const {env,fetchImpl,actions}=envFor({deletionFails:true});
 assert.deepEqual(await runRetention(env,{fetchImpl,log:quiet}),{enabled:true,processed:0,failed:1});
 assert.equal(actions.filter(a=>a[0]==='RPC.finish').length,0);
});
test('corrupted path never deletes even one R2 object',async()=>{
 const {env,fetchImpl,actions}=envFor({badPath:true});
 assert.deepEqual(await runRetention(env,{fetchImpl,log:quiet}),{enabled:true,processed:0,failed:1});
 assert.equal(actions.filter(a=>a[0]==='R2.delete').length,0);
});
test('non-R2 assets block finalization rather than leaving orphaned uploads',async()=>{
 const {env,fetchImpl,actions}=envFor({assets:[{...record,storage_provider:'supabase'}]});
 assert.deepEqual(await runRetention(env,{fetchImpl,log:quiet}),{enabled:true,processed:0,failed:1});
 assert.equal(actions.some(a=>a[0]==='RPC.finish'),false);
});
