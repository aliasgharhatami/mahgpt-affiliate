import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
export const CONFIG=resolve(here,"config.json");
export const QUEUE=resolve(here,"queue.json");
const TZ="Europe/Istanbul";
const localDate=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const validUrl=(v)=>{try{let u=new URL(v);return u.protocol==="https:"&&Boolean(u.hostname)&&!u.username&&!u.password}catch{return false}};
export const daySlots=(day,config)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Invalid date");
 return config.scheduledLocalTimes.map((time,i)=>({
   index:i,kind:config.plannedTypes[i],
   scheduled_at:new Date(day+"T"+time+":00+03:00").toISOString(),
   local_time:time
 }));
};
export function validateQueue(queue,config,{strict=false}={}){
 if(queue?.schema!=="gerde-giti/queue/v1")throw Error("Wrong queue schema");
 if(!Array.isArray(queue.items)||queue.items.length>5)throw Error("Invalid queue size");
 const slot=daySlots(queue.date,config),seen=new Set();let counts={reel:0,photo:0};
 for(const [i,x] of queue.items.entries()){
  if(x.slot!==i||x.kind!==slot[i].kind||x.scheduled_at!==slot[i].scheduled_at)throw Error("Queue slot "+i+" invalid");
  if(!x.id||seen.has(x.id))throw Error("Duplicate or missing id");seen.add(x.id);
  if(!x.country||!x.headline||!x.source_name||!validUrl(x.source_url))throw Error("Every post needs sourced country, headline and URL");
  if(x.caption?.length>2200||typeof x.caption!=="string")throw Error("Instagram caption must be <=2200 characters");
  if(!["draft","approved","inflight","published","failed","blocked"].includes(x.status))throw Error("Unexpected post status");
  if(x.status==="approved"||x.status==="inflight"||x.status==="published"){
   if(!x.reviewed_facts||!x.media_rights_checked||!x.native_persian_checked)throw Error("Approved item "+x.id+" lacks fact, media or Persian-language QA");
   if(!validUrl(x.media_url))throw Error("Approved item "+x.id+" has no public HTTPS media URL");
   if(x.kind==="reel"&&!(x.duration_seconds>=30&&x.duration_seconds<=180&&x.has_narration&&x.subtitle_aligned))throw Error("Reel "+x.id+" duration/narration not approved");
  }
  counts[x.kind]=(counts[x.kind]||0)+1;
 }
 if(strict){
  if(queue.items.length!==5||counts.reel!==3||counts.photo!==2)throw Error("A full day needs 3 reels and 2 photo posts");
  if(new Set(queue.items.map(x=>x.country)).size<3)throw Error("Need at least three countries per full day");
  if(queue.items.some(x=>x.status!=="approved"&&x.status!=="published"))throw Error("Full production queue must be reviewed");
 }
 return {slots:slot,counts};
}
export function pickDue(queue,config,now=new Date()){
 validateQueue(queue,config);
 if(queue.date!==localDate(now))return null;
 return queue.items.find(x=>x.status==="approved"&&Date.parse(x.scheduled_at)<=now.valueOf())||null;
}
export async function readQueue(){
 try{return JSON.parse(await readFile(QUEUE,"utf8"))}
 catch(e){if(e.code==="ENOENT")return null;throw e}
}
export async function saveQueue(queue){await mkdir(dirname(QUEUE),{recursive:true});await writeFile(QUEUE,JSON.stringify(queue,null,2)+"\n","utf8")}
export function newDraftQueue(date,config,candidates=[]){
 const slots=daySlots(date,config);
 const items=slots.slice(0,Math.min(5,candidates.length)).map((s,i)=>({
   id:candidates[i].id,
   slot:s.index,kind:s.kind,scheduled_at:s.scheduled_at,local_time:s.local_time,
   country:candidates[i].country,country_fa:candidates[i].country_fa,
   headline:candidates[i].headline||candidates[i].title,
   source_name:candidates[i].source||candidates[i].source_name,
   source_url:candidates[i].original_url||candidates[i].source_url,
   caption:candidates[i].caption||"",
   media_url:null,story_media_url:null,
   duration_seconds:null,has_narration:false,subtitle_aligned:false,
   reviewed_facts:false,media_rights_checked:false,native_persian_checked:false,
   status:"draft"
 }));
 return {schema:"gerde-giti/queue/v1",date,brand:config.brand,created_at:new Date().toISOString(),items,live:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=JSON.parse(await readFile(CONFIG,"utf8"));
 const [cmd,arg]=process.argv.slice(2);
 if(cmd==="slots")console.log(JSON.stringify(daySlots(arg||localDate(),config),null,2));
 else if(cmd==="validate"){let q=JSON.parse(await readFile(resolve(arg||QUEUE),"utf8"));console.log(JSON.stringify(validateQueue(q,config),null,2))}
 else if(cmd==="build"){
  const data=JSON.parse(await readFile(resolve(arg),"utf8"));
  const date=localDate();const q=newDraftQueue(date,config,data.items||data.stories||[]);
  validateQueue(q,config);
  await saveQueue(q);
  console.log("Wrote "+q.items.length+" DRAFT slots. Auto publishing is disabled until independently checked.");
 } else throw Error("Usage: node automation/queue.mjs slots [YYYY-MM-DD] | build <discovery.json> | validate <queue.json>");
}
