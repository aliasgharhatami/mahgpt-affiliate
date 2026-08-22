import assert from "node:assert/strict";
import { editorialSummary } from "../scripts/social-content.mjs";

const cases=[
["Adobe's Firefly Audio Tools Exit Beta - The AI Economy | Ken Yeung","Adobe has moved its Firefly audio tools out of beta. The update points to a more mature release for creators using Adobe’s AI-powered audio features."],
["Bengaluru startup Murf AI launches low-cost voice model to challenge OpenAI, ElevenLabs","Murf AI has launched a lower-cost voice model aimed at competing with major AI voice platforms including OpenAI and ElevenLabs."],
["Best Free AI Video Editing Apps for Creators in India: CapCut, InVideo and More","A new comparison looks at free AI video-editing options available to creators in India, including CapCut and InVideo."],
["Hostinger AI Builder: How to duplicate a website - Hostinger","Hostinger has published guidance for duplicating a website with its AI Builder."],
["Semrush vs Ahrefs: Which SEO Tool Actually Wins in 2026?","A new comparison examines Semrush and Ahrefs across their SEO capabilities."],
["Canva Acquires Simtheory and Ortto as It Expands Into AI and Marketing Tech - UC Today","Canva has acquired Simtheory and Ortto as it expands further into AI and marketing technology."],
["How to make an AI image in 6 quick steps - Runway","Runway has published a six-step guide to creating AI-generated images with its tools."],
["SOUNDRAW Review on Quasa: Safest AI Music Generator - quasa.io","Quasa has published a review of SOUNDRAW, the AI music-generation platform."],
["Apple Music to start labelling songs as “Created with AI” - BGNES","Apple Music is reportedly preparing to label songs that were created with AI."],
["Best places to sell or trade in an iPhone in 2026: How to get the most money","With Apple’s next iPhone launch approaching, the article looks at ways to sell or trade in an existing iPhone and recover some of its value."]
];
for(const [title,expected] of cases){const actual=editorialSummary({title,summary:"The AI Economy | Ken Yeung",detectedPartner:null});assert.equal(actual,expected,title);assert(!/is the subject of this update|available source metadata|full report provides/i.test(actual))}
console.log("social summary regression tests passed");
