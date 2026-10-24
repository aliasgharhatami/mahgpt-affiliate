import test from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {makeSsml,synthesize} from "../scripts/synthesize-narration.mjs";
const script="gardagard-giti/narration/script.json";
test("Persian female voice SSML and escaping",()=>{
 const v=makeSsml("اسب‌ها & <خبر>");
 assert.ok(v.includes("fa-IR-DilaraNeural"));
 assert.ok(v.includes("&amp; &lt;خبر&gt;"));
});
test("No key: prepare seven SSML segments without pretending audio exists",async()=>{
 const out=await mkdtemp(join(tmpdir(),"giti-tts-"));
 const r=await synthesize({input:script,out,dryRun:true});
 assert.equal(r.count,7);
 const status=JSON.parse(await readFile(join(out,"status.json"),"utf8"));
 assert.equal(status.publishable,false);
 assert.equal(status.status,"ssml_only_no_audio");
});
test("Missing credentials reject production voice generation",async()=>{
 const key=process.env.AZURE_SPEECH_KEY,region=process.env.AZURE_SPEECH_REGION;
 delete process.env.AZURE_SPEECH_KEY;delete process.env.AZURE_SPEECH_REGION;
 try{await assert.rejects(synthesize({input:script,out:"gardagard-giti/output/ttstest",dryRun:false}),/missing/)}
 finally{if(key!==undefined)process.env.AZURE_SPEECH_KEY=key;if(region!==undefined)process.env.AZURE_SPEECH_REGION=region}
});