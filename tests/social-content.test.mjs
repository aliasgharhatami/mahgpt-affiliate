import assert from "node:assert/strict";
import { detectPartner } from "../scripts/social-content.mjs";

const detect = item => detectPartner(item);

assert.equal(detect({
  title: "Best places to sell or trade in an iPhone in 2026: How to get the most money",
  summary: "Macworld explains how to sell an iPhone and compare trade-in offers.",
  source: "https://www.macworld.com/article/230803/iphone-sell-trade-carrier-store-online.html",
  tool: "descript"
}), null, "iPhone/Macworld stories must not inherit item.tool");

assert.equal(detect({
  title: "Adobe's Firefly Audio Tools Exit Beta",
  summary: "Adobe Firefly audio tools are now out of beta.",
  source: "https://example.com/adobe-firefly"
}), "adobe");

assert.equal(detect({
  title: "Canva acquires Simtheory and Ortto as it expands into AI and marketing tech",
  summary: "The Canva acquisition expands its marketing technology footprint.",
  source: "https://example.com/canva"
}), "canva");

assert.equal(detect({
  title: "ElevenLabs launches a new voice model",
  summary: "ElevenLabs announced a new model for synthetic speech.",
  source: "https://example.com/elevenlabs"
}), "elevenlabs");

assert.equal(detect({
  title: "New AI regulations in Europe",
  summary: "European lawmakers debate new rules for artificial intelligence.",
  source: "https://example.com/ai-regulation",
  tool: "semrush"
}), null, "generic AI regulation stories must not inherit a partner");

console.log("social-content partner detection tests passed");
