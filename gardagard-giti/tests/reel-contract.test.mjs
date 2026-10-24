import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateReel} from "../scripts/validate-reel.mjs";
const fixture=JSON.parse(await readFile(new URL("../stories/edirne-reel-v3-preview.json",import.meta.url),"utf8"));
test("preview passes visual contract, but publishing refuses missing narration",()=>{
  assert.equal(validateReel(fixture).valid,true);
  const publish=validateReel(fixture,{publish:true});
  assert.equal(publish.valid,false);
  assert.ok(publish.errors.some(x=>x.includes("Narration audio")));
});
test("timing and tagline constraints enforced",()=>{
 assert.equal(validateReel({...fixture,durationSeconds:29}).valid,false);
 assert.equal(validateReel({...fixture,tagline:"متن دیگر"}).valid,false);
});
