import {writeFile,readFile} from "node:fs/promises";
const file="gardagard-giti/automation/first-real-release-state.json";
const token=process.env.INSTAGRAM_ACCESS_TOKEN;
const account=process.env.INSTAGRAM_ACCOUNT_ID;
const origin="https://gerde-giti-media.onrender.com/media/2026-10-26/edirne-horses-first";
const video=origin+"/reel.mp4";
const caption=[
"هفتهٔ پیش، ۱۹ اکتبر ۲۰۲۶، سه تا اسب سرگردون وسط میدان مسجد تاریخی سلیمیه در شهر ادرنهٔ ترکیه دیده شدن! 🐎",
"گردشگرا عکس گرفتن؛ بعضیا این صحنه رو جالب دونستن و بعضیا هم گفتن مناسب این جای تاریخی نیست. بالاخره مأمورای شهرداری اسب‌ها رو از محوطه دور کردن.",
"🎤 تو اگه اونجا بودی عکس می‌گرفتی یا اعتراض می‌کردی؟",
"منبع خبر: DHA، گزارش ۱۹ اکتبر ۲۰۲۶\nhttps://www.dha.com.tr/yerel-haberler/edirne/edirne-selimiye-camisi-meydaninda-basibos-3-at-2965688",
"⚠️ تصاویر این ویدیو تصویرسازی گرافیکی و مفهومی هستن، نه فیلم واقعی حادثه.",
"فالو کن تا بگردیم به گرد گیتی\n#گرد_گیتی #ترکیه #ادرنه #خبر_محلی"].join("\n\n");
const MARK="هفتهٔ پیش، ۱۹ اکتبر ۲۰۲۶، سه تا اسب سرگردون";
async function state(data){await writeFile(file,JSON.stringify({...data,updated_at:new Date().toISOString()},null,2)+"\n")}
async function api(method,path,params={}){
  const qs=new URLSearchParams(params);
  const url="https://graph.instagram.com/v26.0/"+path+(method==="GET"?"?"+qs:"");
  const options={method,headers:{Authorization:"Bearer "+token}};
  if(method==="POST"){options.headers["Content-Type"]="application/x-www-form-urlencoded";options.body=qs}
  const r=await fetch(url,options);let data={};try{data=await r.json()}catch{}
  if(!r.ok||data.error)throw Error("IG "+method+" "+path+" failed HTTP "+r.status+" error_code "+(data.error?.code||"unknown"));
  return data;
}
async function main(){
  if(!token||!account)throw Error("Missing existing Instagram login secrets");
  let existing;try{existing=JSON.parse(await readFile(file,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
  if(existing?.state==="published"||existing?.state==="attempted"||existing?.state==="unknown")
    {console.log("Fail closed: first item already published or attempted. No second post.");return}
  const identity=await api("GET","me",{fields:"user_id,username"});
  if(String(identity.user_id||identity.id)!==String(account)||identity.username!=="gerde_giti")
    throw Error("Instagram identity mismatch. Publication blocked.");
  const recent=await api("GET",account+"/media",{fields:"id,caption,media_type,permalink",limit:"50"});
  const match=(recent.data||[]).find(x=>x.caption?.includes(MARK));
  if(match){await state({state:"published",instagram_media_id:match.id,permalink:match.permalink,reason:"found_existing"});console.log("Existing first real Reel found. No duplicate.");return}
  const head=await fetch(video,{method:"HEAD",redirect:"follow"});
  if(!head.ok||!(head.headers.get("content-type")||"").startsWith("video/mp4"))
    throw Error("Real Reel MP4 not externally accessible");
  if(Number(head.headers.get("content-length")||0)<100000)throw Error("Video is unexpectedly small");
  const release=await fetch(origin+"/release.json");if(!release.ok)throw Error("Release metadata not hosted");
  const review=await release.json();
  if(review.schema!=="gerde-giti/first-live/v1"||review.id!=="edirne-horses-first"||
     review.event_date!=="2026-10-19"||review.reel_duration_seconds<30||review.instagram_posted!==false)
    throw Error("Release validation failed");
  await state({state:"attempted",source_video:video});
  const create=await api("POST",account+"/media",{media_type:"REELS",video_url:video,caption,share_to_feed:"true"});
  if(!create.id)throw Error("IG creation container id missing");
  await state({state:"attempted",container_id:create.id,source_video:video});
  let ready=false;
  for(let tries=0;tries<40;tries++){
    const s=await api("GET",create.id,{fields:"status_code,status"});
    if(s.status_code==="FINISHED"){ready=true;break}
    if(["ERROR","EXPIRED"].includes(s.status_code))throw Error("Instagram container failed "+s.status_code);
    await new Promise(done=>setTimeout(done,10000));
  }
  if(!ready)throw Error("Container not finished; do not auto-retry");
  const posted=await api("POST",account+"/media_publish",{creation_id:create.id});
  if(!posted.id)throw Error("Instagram did not confirm published ID");
  let permalink=null;
  try{const detail=await api("GET",posted.id,{fields:"permalink"});permalink=detail.permalink}catch{}
  await state({state:"published",instagram_media_id:posted.id,permalink,source_video:video});
  console.log("FIRST_REAL_GITI_PUBLISHED",posted.id,permalink||"");
}
main().catch(async e=>{try{const v=JSON.parse(await readFile(file,"utf8"));if(v.state==="attempted")await state({...v,state:"unknown",reason:"Instagram request uncertain; manual reconciliation required"})}catch{}console.error(String(e.message).slice(0,240));process.exitCode=1});
