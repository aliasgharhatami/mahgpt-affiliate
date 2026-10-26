import {readFile,access} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
const allowed=JSON.parse(await readFile(fileURLToPath(new URL("../config/reel-contract.json",import.meta.url)),"utf8"));

export function validateReel(data,{publish=false}={}){
 const errors=[];
 const reject=(condition,message)=>{if(!condition)errors.push(message)};
 reject(data.brand===allowed.brand.name,"Incorrect brand name");
 reject(data.tagline===allowed.brand.tagline,"Missing/incorrect permanent tagline");
 reject(Number.isFinite(data.durationSeconds)&&data.durationSeconds>=30&&data.durationSeconds<=180,"Reel must be between 30 and 180 seconds");
 reject(data.cover?.durationSeconds>=3&&data.cover?.durationSeconds<=5,"Cover must lead for 3 to 5 seconds");
 reject(data.visuals?.some(v=>v.type==="photo"||v.type==="video"),"Main story must have photographic or video material");
 reject(data.visuals?.every(v=>v.reconstruction!==true||v.label==="بازسازی تصویری"),"All AI reconstructions must be labeled on-screen");
 reject(Boolean(data.sourceURL?.startsWith("https://")),"Verified source URL required");
 reject(Boolean(data.captionPanel?.fixedPosition),"Captions must have one stable on-screen box position");
 reject(Boolean(data.motion?.panOrZoom)&&Boolean(data.motion?.animatedCaptions),"Must contain real motion and animated captions");
 reject(Array.isArray(data.sentences)&&data.sentences.length>0,"Provide the exact narration sentences");
 if(publish){
  reject(data.narration?.language==="fa-IR"&&data.narration?.voiceGender==="female","Female Persian narration required");
  reject(Boolean(data.narration?.file),"Narration audio file is required");
  reject(Boolean(data.narration?.humanQualityChecked),"Voice must pass pronunciation/naturalness review");
  reject(Boolean(data.narration?.timingDerivedFromAudio),"Caption timing MUST be derived from actual speech audio");
  reject(Boolean(data.sentences?.every(s=>s.text===s.spokenText&&s.start>=0&&s.end>s.start&&s.end<=data.durationSeconds)),"Visible sentences must match spoken sentences and be time-aligned");
  reject(Boolean(data.visuals?.every(v=>v.license&&v.credit)),"Each asset requires rights and credit records");
  reject(Boolean(data.videoFile)&&Boolean(data.cover?.file),"Encoded video and cover must exist");
 }
 return {valid:errors.length===0,errors};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const path=process.argv[2];
 if(!path)throw new Error("Usage: node validate-reel.mjs manifest.json [--publish]");
 const input=JSON.parse(await readFile(path,"utf8"));
 const check=validateReel(input,{publish:process.argv.includes("--publish")});
 if(!check.valid){console.error(JSON.stringify(check,null,2));process.exitCode=1;}
 else console.log("PASS: reel manifest editorial safety checks");
}
