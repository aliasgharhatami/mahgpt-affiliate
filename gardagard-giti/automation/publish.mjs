import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {CONFIG,QUEUE,readQueue,saveQueue,validateQueue,pickDue} from "./queue.mjs";

const apiHost="https://graph.instagram.com";
const version=process.env.INSTAGRAM_GRAPH_VERSION||"v26.0";
const token=process.env.INSTAGRAM_ACCESS_TOKEN;
const account=process.env.INSTAGRAM_ACCOUNT_ID;
const url=path=>apiHost+"/"+version+"/"+path.replace(/^\//,"");
const api=async(method,path,params={})=>{
 if(!token)throw Error("Missing Instagram token");
 const requestUrl=url(path);
 const methodUpper=method.toUpperCase();
 const options={method:methodUpper,headers:{Authorization:"Bearer "+token}};
 if(methodUpper!=="GET"){
  options.headers["Content-Type"]="application/x-www-form-urlencoded";
  options.body=new URLSearchParams(params);
 }else{
  const qs=new URLSearchParams(params);
  if(qs.toString())return callApi(requestUrl+"?"+qs,options,path);
 }
 return callApi(requestUrl,options,path);
};
async function callApi(target,options,path){
 const response=await fetch(target,options);
 let data={};
 try{data=await response.json()}catch{}
 if(!response.ok||data?.error){
  const err=data?.error||{};
  const e=new Error("Instagram "+options.method+" "+path+" failed: HTTP "+response.status+" code="+(err.code??"?")+" "+String(err.message||"Unknown error").slice(0,180));
  e.code=err.code;e.httpStatus=response.status;throw e;
 }
 return data;
}
export function captionFor(item){
 const raw=(item.caption||"").trim();
 const extras=[item.country_fa||"", "منبع: "+item.source_name, item.source_url,"فالو کن تا بگردیم به گرد گیتی","#گرد_گیتی #خبر_محلی"];
 const text=[raw,...extras.filter(Boolean)].join("\n\n");
 if(text.length>2200)throw Error("Instagram caption is too long");
 return text;
}
const safeError=error=>String(error?.message||error).replace(/(access_token|Bearer|OAuth)[^\n]*/gi,"$1 [redacted]").slice(0,350);
const assertPublic=async(urlValue,type)=>{
 let x=new URL(urlValue);
 if(x.protocol!=="https:"||x.username||x.password)throw Error("Media must be public HTTPS");
 let r=await fetch(urlValue,{method:"HEAD",headers:{"User-Agent":"GerdeGitiPublisher/1.0"},redirect:"follow"});
 if(!r.ok)throw Error("Media URL HEAD status "+r.status);
 let kind=(r.headers.get("content-type")||"").split(";")[0];
 if(type==="reel"&&!["video/mp4","video/quicktime","application/octet-stream"].includes(kind))throw Error("Reels require publicly downloadable MP4");
 if(type==="image"&&!["image/jpeg","image/jpg"].includes(kind))throw Error("Image and story need public JPEG");
 return kind;
};
const poll=async container=>{
 for(let n=0;n<30;n++){
  const data=await api("GET",container,{fields:"status_code,status"});
  if(data.status_code==="FINISHED")return;
  if(data.status_code==="ERROR"||data.status_code==="EXPIRED")throw Error("Instagram container failed "+String(data.status||"").slice(0,180));
  await new Promise(done=>setTimeout(done,10000));
 }
 throw Error("Instagram media conversion timed out");
};
async function publishItem(item,kind,urlValue,caption){
 await assertPublic(urlValue,kind==="reel"?"reel":"image");
 const params=kind==="reel"?{media_type:"REELS",video_url:urlValue,share_to_feed:"true",thumb_offset:"0",caption}:kind==="story"?{media_type:"STORIES",image_url:urlValue}:{image_url:urlValue,caption};
 const container=await api("POST",account+"/media",params);
 if(!container.id)throw Error("Instagram did not return media container");
 await poll(container.id);
 const result=await api("POST",account+"/media_publish",{creation_id:container.id});
 if(!result.id)throw Error("Instagram did not return published media id");
 return result.id;
}
const config=JSON.parse(await readFile(CONFIG,"utf8"));
const mode=process.argv[2]||"dry-run";
const requireLive=()=>{
 if(!config.publication?.enabled||process.env.GITI_LIVE_PUBLISHING!=="true")throw Error("Public posting blocked. Requires config enabled AND GITI_LIVE_PUBLISHING=true.");
};
async function main(){
 if(mode==="check-account"){
  if(!token||!account)throw Error("Instagram credentials missing");
  const data=await api("GET","me",{fields:"user_id,username"});
  if(!data.id&&!data.user_id)throw Error("Instagram Login /me did not return user ID");
  if(String(data.user_id||data.id)!==String(account))throw Error("INSTAGRAM_ACCOUNT_ID differs from Instagram Login user");
  console.log("Existing Instagram Login is readable; account ID matches. NO posts created.");
  return;
 }
 const queue=await readQueue();
 if(!queue){console.log("No separate Gerde Giti queue yet; no action.");return}
 validateQueue(queue,config);
 if(mode==="dry-run"){
  let x=pickDue(queue,config);
  console.log(JSON.stringify({mode:"no-posting",liveEnabled:config.publication.enabled,queueLive:queue.live||false,queued:queue.items.length,approved:queue.items.filter(x=>x.status==="approved").length,due:x?.id||null,publicMediaUrlsReady:queue.items.filter(x=>x.media_url).length,telegramWebsiteTouched:false},null,2));
  return;
 }
 if(mode==="claim"){
  requireLive();
  if(queue.live!==true)throw Error("Separate queue has not been approved for live publishing");
  const item=pickDue(queue,config);
  if(!item){console.log("No approved due item; no action.");return}
  item.status="inflight";
  item.claimed_at=new Date().toISOString();
  await saveQueue(queue);
  console.log("Claimed item "+item.id+" as inflight to protect against duplicate publication.");
  return;
 }
 if(mode==="publish-claimed"){
  requireLive();
  if(!token||!account)throw Error("Instagram credentials missing");
  if(queue.date!==new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date())){
   throw Error("Claimed item belongs to another date; manual reconciliation required");
  }
  const item=queue.items.find(x=>x.status==="inflight");
  if(!item){console.log("No claimed item; no action.");return}
  const age=Date.now()-Date.parse(item.claimed_at||"");
  if(!Number.isFinite(age)||age<0||age>15*60*1000)throw Error("In-flight claim is stale; must not retry publication automatically");
  try{
   const mainId=await publishItem(item,item.kind,item.media_url,captionFor(item));
   item.instagram_id=mainId;
   item.status="published";
   item.published_at=new Date().toISOString();
   console.log("Instagram main "+item.kind+" successfully published, story id "+item.id);
   await saveQueue(queue); // save immediately before attempting secondary story
   if(item.kind==="photo"&&item.story_media_url){
    try{
     const storyId=await publishItem(item,"story",item.story_media_url,"");
     item.instagram_story_id=storyId;item.story_status="published";item.story_published_at=new Date().toISOString();
     console.log("Story published for "+item.id);
    }catch(e){item.story_status="failed";item.story_error=safeError(e);console.error("Story failed without re-publishing feed post:",safeError(e))}
    await saveQueue(queue);
   }
  }catch(e){
   item.status="blocked";item.error=safeError(e);item.failed_at=new Date().toISOString();
   await saveQueue(queue);
   console.error("Publishing blocked; manual reconciliation is required before retry.",item.error);
   throw e;
  }
  return;
 }
 throw Error("Usage: node publish.mjs check-account|dry-run|claim|publish-claimed");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(safeError(e));process.exitCode=1});
