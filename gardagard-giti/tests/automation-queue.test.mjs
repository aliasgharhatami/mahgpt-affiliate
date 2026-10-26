import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {daySlots,validateQueue,pickDue,newDraftQueue} from "../automation/queue.mjs";
const config=JSON.parse(readFileSync(new URL("../automation/config.json",import.meta.url),"utf8"));
const c=(i)=>({id:"story-"+i,country:["PY","UZ","VN","TR","JM"][i],country_fa:["پاراگوئه","ازبکستان","ویتنام","ترکیه","جامائیکا"][i],original_url:"https://example.org/post/"+i,source:"Local Press",title:"خبر متفاوت "+i});
test("five distinct posting slots use fixed Istanbul time and correct formats",()=>{
 const a=daySlots("2026-10-27",config);
 assert.equal(a.length,5);
 assert.deepEqual(a.map(v=>v.kind),["reel","photo","reel","photo","reel"]);
 assert.deepEqual(a.map(v=>v.scheduled_at),["2026-10-27T07:00:00.000Z","2026-10-27T10:00:00.000Z","2026-10-27T13:00:00.000Z","2026-10-27T16:00:00.000Z","2026-10-27T18:30:00.000Z"]);
});
test("unapproved discoveries cannot post even after their scheduled time",()=>{
 const q=newDraftQueue("2026-10-27",config,Array.from({length:5},(_,i)=>c(i)));
 assert.equal(validateQueue(q,config).counts.reel,3);
 assert.equal(pickDue(q,config,new Date("2026-10-27T21:00:00Z")),null);
 assert.throws(()=>validateQueue(q,config,{strict:true}),/reviewed/);
});
test("only manually reviewed and media-cleared valid reel can publish",()=>{
 const q=newDraftQueue("2026-10-27",config,[c(0)]);
 let x=q.items[0];x.status="approved";
 assert.throws(()=>validateQueue(q,config),/lacks fact/);
 Object.assign(x,{reviewed_facts:true,media_rights_checked:true,native_persian_checked:true,media_url:"https://example.org/reel.mp4",duration_seconds:51,has_narration:true,subtitle_aligned:true,caption:"یک خبر عجیب محلی"});
 assert.equal(pickDue(q,config,new Date("2026-10-27T07:00:01Z")).id,x.id);
 x.status="inflight";
 assert.equal(pickDue(q,config,new Date("2026-10-27T21:00:00Z")),null);
});
test("cannot use duplicate country-agnostic slots, missing URLs or unsupported duration",()=>{
 const q=newDraftQueue("2026-10-27",config,[c(0),c(1)]);
 q.items[1].id=q.items[0].id;
 assert.throws(()=>validateQueue(q,config),/Duplicate/);
 q.items[1].id="fresh";
 q.items[0].source_url="http://not-https.example.org/";
 assert.throws(()=>validateQueue(q,config),/sourced country/);
});
