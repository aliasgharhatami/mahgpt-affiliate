/** Publish at most ONE separately reviewed Gerde Giti trial Reel.
 * Independent from MahGPT Telegram queue; no schedules. Requires the hosted
 * release metadata to match the final visual/audio artifact, and IG identity.
 */
import {readFile,writeFile} from "node:fs/promises";
const stateFile="gardagard-giti/automation/second-pilot-release-state.json";
const origin="https://gerde-giti-media.onrender.com/media/2026-10-26/china-water-motorcycle-20261025";
const sourceVideo=origin+"/reel.mp4";
const token=process.env.INSTAGRAM_ACCESS_TOKEN;
const account=process.env.INSTAGRAM_ACCOUNT_ID;
const marker="موتورسیکلت روی آب؟ بله، واقعاً!";
const url=p=>"https://graph.instagram.com/v26.0/"+p;
async function api(method,p,params={}){
  if(!token||!account)throw Error("Existing Instagram secrets missing");
  const qs=new URLSearchParams(params);
  const opts={method,headers:{Authorization:"Bearer "+token}};
  if(method==="POST"){opts.headers["Content-Type"]="application/x-www-form-urlencoded";opts.body=qs}
  const res=await fetch(url(p)+(method==="GET"?"?"+qs:""),opts);
  let val={};try{val=await res.json()}catch{}
  if(!res.ok||val.error)throw Error("IG "+method+" "+p+" HTTP="+res.status+" error-code="+(val.error?.code||"?"));
  return val;
}
async function save(s){await writeFile(stateFile,JSON.stringify({...s,updated_at:new Date().toISOString()},null,2)+"\n")}
async function run(){
  let prev=null;try{prev=JSON.parse(await readFile(stateFile,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
  if(prev&&["attempted","unknown","published"].includes(prev.state)){console.log("SECOND_REEL_LOCKED",prev.state);return}
  const me=await api("GET","me",{fields:"user_id,username"});
  if(String(me.user_id||me.id)!==String(account)||me.username!=="gerde_giti")throw Error("Wrong Instagram account");
  const media=await api("GET",account+"/media",{fields:"id,caption,media_type,permalink",limit:"50"});
  const dupe=(media.data||[]).find(x=>x.caption?.includes(marker));
  if(dupe){await save({state:"published",instagram_media_id:dupe.id,permalink:dupe.permalink,reason:"existing"});return}
  const r=await fetch(origin+"/release.json",{cache:"no-store"});if(!r.ok)throw Error("Release manifest not publicly readable");
  const rel=await r.json();
  if(rel.schema!=="gerde-giti/second-pilot/v1"||rel.id!=="china-water-motorcycle-20261025"||rel.image_count<3||
     rel.narration_first_second!==1||rel.duration_seconds<30||rel.duration_seconds>180||
     rel.file_size<1000000||rel.published!==false||
     !/^[a-f0-9]{64}$/.test(rel.sha256))throw Error("Unverified video release metadata");
  const head=await fetch(sourceVideo,{method:"HEAD",cache:"no-store"});
  if(!head.ok||!String(head.headers.get("content-type")).startsWith("video/mp4"))throw Error("No public MP4");
  if(Number(head.headers.get("content-length"))!==rel.file_size)throw Error("Wrong public MP4 size");
  const captionOriginal=await fetch(origin+"/caption.txt",{cache:"no-store"});
  if(!captionOriginal.ok)throw Error("Cannot read caption");
  let caption=await captionOriginal.text();
  if(!caption.includes(marker))throw Error("Caption marker missing");
  // Creative Commons attributions are explicit; archive images do not depict this incident.
  let credits=rel.image_attribution.map(x=>x.creator+" ("+x.license+")").join("، ");
  caption+="\n\nاعتبار تصاویر آرشیوی: "+credits+
        "\nمجوز و لینک اصل تصاویر: "+origin+"/attribution.json";
  if(caption.length>2200)throw Error("Caption exceeds Instagram limits");
  await save({state:"attempted",source_video:sourceVideo,hash:rel.sha256});
  const created=await api("POST",account+"/media",{media_type:"REELS",video_url:sourceVideo,
       caption,share_to_feed:"true"});
  if(!created.id)throw Error("Instagram container missing");
  await save({state:"attempted",container_id:created.id,source_video:sourceVideo,hash:rel.sha256});
  let ok=false;
  for(let i=0;i<35;i++){
     const st=await api("GET",created.id,{fields:"status_code,status"});
     if(st.status_code==="FINISHED"){ok=true;break}
     if(["ERROR","EXPIRED"].includes(st.status_code))throw Error("Instagram transcoding "+st.status_code);
     await new Promise(resolve=>setTimeout(resolve,10000));
  }
  if(!ok)throw Error("Transcoding timeout; do not retry automatically");
  const result=await api("POST",account+"/media_publish",{creation_id:created.id});
  if(!result.id)throw Error("No media ID after Instagram publish");
  let permalink=null;
  try{permalink=(await api("GET",result.id,{fields:"permalink"})).permalink}catch{}
  await save({state:"published",instagram_media_id:result.id,permalink,source_video:sourceVideo,hash:rel.sha256});
  console.log("SECOND_GITI_REEL_PUBLISHED",result.id,permalink||"");
}
run().catch(async e=>{
  try{const s=JSON.parse(await readFile(stateFile,"utf8"));if(s.state==="attempted")await save({...s,state:"unknown",reason:"do not retry until Instagram state is inspected"})}catch{}
  console.error("SECOND_PILOT_FAILED",String(e.message||e).slice(0,300));process.exitCode=1
});