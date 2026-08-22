import assert from "node:assert/strict";
import { slotTimes } from "../scripts/social-queue.mjs";
import { cleanHeadline, inferSourceName } from "../scripts/social-content.mjs";

const adobe={title:"Adobe's Firefly Audio Tools Exit Beta - The AI Economy | Ken Yeung",source:"https://news.google.com/rss/articles/example"};
assert.equal(cleanHeadline(adobe.title,adobe),"Adobe's Firefly Audio Tools Exit Beta");
assert.equal(inferSourceName(adobe),"The AI Economy");
assert.equal(inferSourceName({title:"Best Free AI Video Editing Apps for Creators in India: CapCut, InVideo and More - Gadgets 360",source:"https://news.google.com/rss/articles/example"}),"Gadgets 360");
assert.equal(inferSourceName({title:"Canva Acquires Simtheory and Ortto - UC Today",source:"https://news.google.com/rss/articles/example"}),"UC Today");
assert.equal(cleanHeadline("Hostinger AI Builder: How to duplicate a website - Hostinger"),"Hostinger AI Builder: How to duplicate a website");
assert.equal(cleanHeadline("How to make an AI image in 6 quick steps - Runway"),"How to make an AI image in 6 quick steps");
assert.equal(cleanHeadline("SOUNDRAW Review on Quasa: Safest AI Music Generator - quasa.io"),"SOUNDRAW Review on Quasa: Safest AI Music Generator");
assert.equal(cleanHeadline("Apple Music to start labelling songs as “Created with AI” - BGNES"),"Apple Music to start labelling songs as “Created with AI”");

const slots=slotTimes({year:2026,month:8,day:22});
assert.equal(slots.length,10);
assert(slots.every((slot,i)=>i===0||slots[i-1]<slot));
assert.equal(slots[0],"2026-08-22T05:20:00.000Z");
assert.equal(slots[8],"2026-08-22T21:20:00.000Z");
assert.equal(slots[9],"2026-08-22T23:20:00.000Z");\nconst local=value=>new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",day:"2-digit"}).format(new Date(value));\nassert.equal(local(slots[7]),"22, 22:20");\nassert.equal(local(slots[8]),"23, 00:20");\nassert.equal(local(slots[9]),"23, 02:20");
console.log("social queue chronology and source tests passed");
