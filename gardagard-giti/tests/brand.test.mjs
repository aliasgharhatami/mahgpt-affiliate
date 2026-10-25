import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderCoverSvg } from "../scripts/render-covers.mjs";

const brand=JSON.parse(await readFile("gardagard-giti/config/brand.json","utf8"));
const story=JSON.parse(await readFile("gardagard-giti/stories/2026-10-19-edirne-horses.json","utf8"));

test("approved brand and fixed tagline on all three formats",()=>{
  assert.equal(brand.name,"گرد گیتی");
  assert.equal(brand.tagline,"فالو کن تا بگردیم به گرد گیتی");
  for(const format of ["reel","feed","story"]){
    const svg=renderCoverSvg(story,brand,format);
    assert.ok(svg.includes(brand.name));
    assert.ok(svg.includes(brand.tagline));
    assert.ok(svg.includes(story.city));
    assert.ok(svg.includes('y="'+Math.round(brand.formats[format].height*.75)));
    assert.ok(svg.includes("تصویرسازی مفهومی"));
  }
});

test("unsupported format and missing article title are rejected",()=>{
  assert.throws(()=>renderCoverSvg(story,brand,"nonexistent"),/Unsupported/);
  assert.throws(()=>renderCoverSvg({...story,headlineLines:[]},brand,"reel"),/headline/);
});

test("publication disabled and MahGPT production untouched",()=>{
  assert.equal(brand.publishing_enabled,false);
  assert.equal(brand.schedule.reels_per_day,3);
  assert.equal(brand.schedule.photos_per_day,2);
  assert.equal(brand.schedule.share_photos_to_story,true);
});
