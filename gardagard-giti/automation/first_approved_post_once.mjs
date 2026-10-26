import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const file = "gardagard-giti/automation/first-approved-release-state.json";
const base = "https://gerde-giti-media.onrender.com/media/2026-10-26/edirne-horses-first/";
const video = base + "reel-approved.mp4";
const manifest = base + "approved-release.json";
const shaExpected = "cee6b7362d4766a13e6eb003d3395f4c60b67f6596ae1c1865a771299e232660";
const token = process.env.INSTAGRAM_ACCESS_TOKEN;
const account = process.env.INSTAGRAM_ACCOUNT_ID;
const marker = "سه تا اسب وسط میدان تاریخی مسجد سلیمیه، در ادرنه";
const caption = [
 "سه تا اسب وسط میدان تاریخی مسجد سلیمیه، در ادرنه! 🐎",
 "۱۹ اکتبر ۲۰۲۶، سه تا اسب سرگردون وارد میدان مسجد سلیمیه در ترکیه شدن و خیلی راحت روی چمن‌ها مشغول چرا شدن؛ انگار نه انگار وسط یکی از دیدنی‌ترین جاهای شهرن!",
 "مردم و گردشگرا از این صحنه عکس گرفتن. بعضیا براشون بامزه بود، بعضیا هم این وضعیت رو نامناسب یا خطرناک می‌دونستن. در نهایت نیروهای شهرداری اسب‌ها رو از میدان دور کردن.",
 "تو اونجا بودی، عکس می‌گرفتی یا اعتراض می‌کردی؟ نظرت رو توی کامنت‌ها بگو! 👇",
 "🎨 تصاویر ویدیو بازسازی گرافیکی هستن و فیلم واقعی این اتفاق نیستن.",
 "منبع: DHA، ۱۹ اکتبر ۲۰۲۶\nhttps://www.dha.com.tr/yerel-haberler/edirne/edirne-selimiye-camisi-meydaninda-basibos-3-at-2965688",
 "فالو کن تا بگردیم به گرد گیتی 🌍\n#گرد_گیتی #ادرنه #ترکیه #سلیمیه #اخبار_جالب"
].join("\n\n");
async function save(s) {
 await writeFile(file,JSON.stringify({...s,updated_at:new Date().toISOString()},null,2)+"\n");
}
async function api(method,path,params={}) {
 const query=new URLSearchParams(params);
 const endpoint="https://graph.instagram.com/v26.0/"+path+(method==="GET"?"?"+query:"");
 const opt={method,headers:{"Authorization":"Bearer "+token}};
 if(method==="POST"){opt.headers["Content-Type"]="application/x-www-form-urlencoded";opt.body=query;}
 const resp=await fetch(endpoint,opt);
 const j=await resp.json().catch(()=>({}));
 if(!resp.ok||j.error)throw Error("IG "+method+" "+path+" failed HTTP "+resp.status+" code "+(j.error?.code||"unknown")+" "+String(j.error?.message||"").slice(0,100));
 return j;
}
async function verifyMedia() {
 const r=await fetch(video,{redirect:"follow"});
 if(!r.ok)throw Error("Video not hosted: HTTP "+r.status);
 if(!(r.headers.get("content-type")||"").startsWith("video/mp4"))throw Error("Hosted URL is not MP4");
 const b=Buffer.from(await r.arrayBuffer());
 if(b.length!==3090553)throw Error("Hosted MP4 size mismatch: "+b.length);
 const sha=createHash("sha256").update(b).digest("hex");
 if(sha!==shaExpected)throw Error("Hosted video SHA256 mismatch");
 const mr=await fetch(manifest);
 if(!mr.ok)throw Error("Approval metadata unavailable");
 const m=await mr.json();
 if(m.video_sha256!==shaExpected||m.approved_by_user!==true||m.instagram_posted!==false||m.hold_future_posts!==true)throw Error("Approval metadata mismatch");
 console.log("EXACT_APPROVED_MP4_VERIFIED",b.length,sha);
}
async function main() {
 if(!token||!account)throw Error("Missing existing Instagram secrets");
 let existing;
 try{existing=JSON.parse(await readFile(file,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e;}
 if(["published","attempted","unknown"].includes(existing?.state)){console.log("Already attempted/published: no duplicate.");return;}
 const identity=await api("GET","me",{fields:"user_id,username"});
 if(String(identity.user_id||identity.id)!==String(account)||identity.username!=="gerde_giti")throw Error("Not the @gerde_giti Instagram account");
 const recent=await api("GET",account+"/media",{fields:"id,caption,media_type,permalink",limit:"50"});
 const match=(recent.data||[]).find(p=>p.caption?.includes(marker));
 if(match){await save({state:"published",instagram_media_id:match.id,permalink:match.permalink,reason:"found_existing"});return;}
 await verifyMedia();
 await save({state:"attempted",source_video:video});
 const created=await api("POST",account+"/media",{media_type:"REELS",video_url:video,caption,share_to_feed:"true"});
 if(!created.id)throw Error("Instagram did not create a media container");
 await save({state:"attempted",container_id:created.id,source_video:video});
 let ready=false;
 for(let i=0;i<40;i++) {
  const check=await api("GET",created.id,{fields:"status_code,status"});
  if(check.status_code==="FINISHED"){ready=true;break;}
  if(check.status_code==="ERROR"||check.status_code==="EXPIRED")throw Error("Instagram processing failed: "+check.status_code);
  await new Promise(r=>setTimeout(r,10000));
 }
 if(!ready)throw Error("Instagram processing did not finish; no automatic retry");
 const posted=await api("POST",account+"/media_publish",{creation_id:created.id});
 if(!posted.id)throw Error("Instagram did not confirm publication");
 let permalink=null;
 try{permalink=(await api("GET",posted.id,{fields:"permalink"})).permalink||null}catch{}
 await save({state:"published",instagram_media_id:posted.id,permalink,source_video:video,sha256:shaExpected});
 console.log("APPROVED_GITI_REEL_PUBLISHED",posted.id,permalink||"");
}
main().catch(async e=>{
 try{const v=JSON.parse(await readFile(file,"utf8"));if(v.state==="attempted")await save({...v,state:"unknown",reason:"Reconcile before retry"});}catch{}
 console.error(String(e.message||e).slice(0,300));
 process.exitCode=1;
});
