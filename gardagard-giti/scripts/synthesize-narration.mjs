import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const xml=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export const makeSsml=(text,voice="fa-IR-DilaraNeural")=>'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fa-IR"><voice name="'+xml(voice)+'"><prosody rate="+2%">'+xml(text)+'</prosody></voice></speak>';
const call=(bin,args)=>{const r=spawnSync(bin,args,{encoding:"utf8"});if(r.error||r.status!==0)throw new Error(bin+" failed: "+(r.error?.message||r.stderr));return String(r.stdout||"").trim()};
const duration=p=>Number(call("ffprobe",["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",p]));
const time=s=>{const m=Math.round(s*1000);return [Math.floor(m/3600000),Math.floor(m%3600000/60000),Math.floor(m%60000/1000)].map(x=>String(x).padStart(2,"0")).join(":")+","+String(m%1000).padStart(3,"0")};
export async function synthesize({input="gardagard-giti/narration/script.json",out="gardagard-giti/output/narration",dryRun=false}={}){
 const job=JSON.parse(await readFile(resolve(input),"utf8"));
 if(job.language!=="fa-IR"||job.voice_gender!=="female"||job.voice!=="fa-IR-DilaraNeural")throw new Error("Incorrect Persian female TTS profile");
 if(!job.sentences?.length||job.sentences.some(s=>!s.text?.trim()))throw new Error("Narration sentences missing");
 const dir=resolve(out),key=process.env.AZURE_SPEECH_KEY,region=process.env.AZURE_SPEECH_REGION;
 if(!dryRun&&(!key||!region))throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION missing: cannot generate real narration, no fake fallback");
 if(region&&!/^[a-zA-Z0-9-]+$/.test(region))throw new Error("Invalid Azure region");
 await mkdir(dir,{recursive:true});
 if(dryRun){
  for(const [i,s] of job.sentences.entries())await writeFile(join(dir,"ssml-"+String(i+1).padStart(2,"0")+".xml"),makeSsml(s.text,job.voice));
  await writeFile(join(dir,"status.json"),JSON.stringify({status:"ssml_only_no_audio",publishable:false,count:job.sentences.length},null,2));
  return {status:"ssml_only_no_audio",count:job.sentences.length};
 }
 const wavs=[],segments=[],pause=Number(job.pause_seconds??0.25);
 let elapsed=Number(job.intro_seconds??3);
 for(const [i,s] of job.sentences.entries()){
  const rsp=await fetch("https://"+region+".tts.speech.microsoft.com/cognitiveservices/v1",{method:"POST",headers:{"Ocp-Apim-Subscription-Key":key,"Content-Type":"application/ssml+xml","X-Microsoft-OutputFormat":"riff-24khz-16bit-mono-pcm","User-Agent":"GardagardGitiVoice/1.0"},body:makeSsml(s.text,job.voice)});
  if(!rsp.ok)throw new Error("Voice generation HTTP "+rsp.status+" for sentence "+(i+1));
  const p=join(dir,"segment-"+String(i+1).padStart(2,"0")+".wav");
  await writeFile(p,Buffer.from(await rsp.arrayBuffer()));
  const d=duration(p);
  if(!Number.isFinite(d)||d<0.1)throw new Error("Invalid narration clip duration");
  segments.push({id:s.id,text:s.text,spokenText:s.text,start:+elapsed.toFixed(3),end:+(elapsed+d).toFixed(3),audioFile:p});
  elapsed+=d+(i<job.sentences.length-1?pause:0);
  wavs.push(p);
 }
 if(elapsed<30||elapsed>180)throw new Error("Narration must fit the 30 to 180 second reel limit");
 const intro=join(dir,"intro.wav"),gap=join(dir,"gap.wav");
 for(const [p,d] of [[intro,Number(job.intro_seconds??3)],[gap,pause]])call("ffmpeg",["-v","error","-y","-f","lavfi","-i","anullsrc=r=24000:cl=mono","-t",String(d),"-c:a","pcm_s16le",p]);
 const files=[intro];
 for(let i=0;i<wavs.length;i++){files.push(wavs[i]);if(i<wavs.length-1)files.push(gap)}
 const list=join(dir,"concat.txt");
 await writeFile(list,files.map(f=>"file '"+f.replace(/'/g,"'\\''")+"'").join("\n")+"\n");
 const audio=join(dir,"narration.wav");
 call("ffmpeg",["-v","error","-y","-f","concat","-safe","0","-i",list,"-c:a","pcm_s16le",audio]);
 await writeFile(join(dir,"narration.srt"),segments.map((s,i)=>String(i+1)+"\n"+time(s.start)+" --> "+time(s.end)+"\n"+s.text+"\n").join("\n"));
 const result={status:"speech_generated_pending_human_pronunciation_check",audioFile:audio,voice:job.voice,durationSeconds:duration(audio),segments,captionTimesDerivedFromRecordedAudio:true,publishable:false};
 await writeFile(join(dir,"timing.json"),JSON.stringify(result,null,2)+"\n");
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 synthesize({input:process.argv[2],out:process.argv[3],dryRun:process.argv.includes("--dry-run")}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
}
