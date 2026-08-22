import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { cleanHeadline, cleanText, editorialSummary, storySlug, sourceName, detectPartner } from "./social-content.mjs";

const FEED="assets/news-feed.json", LINKS="config/social-affiliate-links.json", STATE="data/telegram-published.json";
const CHANNEL=process.env.TELEGRAM_CHANNEL||"@mahgptplus", TOKEN=process.env.TELEGRAM_BOT_TOKEN, mode=process.argv[2]||"automatic";
const readJson=async(path,fallback)=>{try{return JSON.parse(await readFile(path,"utf8"))}catch{return fallback}};
const keyFor=n=>n.source||[n.title,n.publishedAt].join("|");
const normalized=n=>{const headline=cleanHeadline(n.headline||n.title);const partner=detectPartner({...n,headline});return {story_id:keyFor(n),headline,summary:editorialSummary({...n,headline,detectedPartner:partner}),mahgpt_url:"https://mahgpt.com/news/story.html?id="+encodeURIComponent(storySlug(headline)),source_name:sourceName(n.source),source_url:n.source||"",image:n.image||"",detected_partner:partner,tool:n.tool,toolName:n.toolName}};
const escapeHtml=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const resolveProduct=(post,links)=>{const e=post.detected_partner ? (links[post.detected_partner] || {}) : {};if(e.status==="active"&&e.affiliateUrl)return {url:e.affiliateUrl,affiliate:true};if(e.status==="pending"||e.status==="none")return {url:e.redirectPath||e.officialUrl||"",affiliate:false};return {url:"",affiliate:false}};
const formatPost=(post,product)=>{
  const source=post.source_name?"\n\n<i>Source: "+escapeHtml(post.source_name)+"</i>":"";
  const cta=product.url?"\n\n🚀 <b>Explore "+escapeHtml(post.toolName||post.detected_partner)+"</b>\n"+escapeHtml(product.url):"";
  const disclosure=product.affiliate?"\n\n<i>Affiliate disclosure: MahGPT may earn a commission from this link.</i>":"";
  return "<b>"+escapeHtml(post.headline)+"</b>\n\n"+escapeHtml(post.summary)+source+"\n\n🔗 <b>Read the full story on MahGPT</b>\n"+escapeHtml(post.mahgpt_url)+cta+disclosure;
};
const api=async(method,fields)=>{const r=await fetch("https://api.telegram.org/bot"+TOKEN+"/"+method,{method:"POST",body:fields});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.description||"Telegram API request failed");return d};
const send=async(post,links)=>{
  const product=resolveProduct(post,links), text=formatPost(post,product);
  if(post.image&&!/googleusercontent\.com|news-default\.svg/i.test(post.image)){
    const file="telegram-image-"+Date.now()+".tmp";
    try{const r=await fetch(post.image,{headers:{"user-agent":"MahGPT-TelegramPublisher/1.0"}});if(r.ok){await pipeline(r.body,createWriteStream(file));const f=new FormData();f.append("chat_id",CHANNEL);f.append("caption",text);f.append("parse_mode","HTML");f.append("photo",new Blob([await readFile(file)]),"news-image");await api("sendPhoto",f);return "photo"}}finally{await unlink(file).catch(()=>{})}
  }
  await api("sendMessage",new URLSearchParams({chat_id:CHANNEL,text,parse_mode:"HTML",disable_web_page_preview:"false"}));return "message";
};
if(!TOKEN){console.error("Telegram publishing skipped: TELEGRAM_BOT_TOKEN is not configured.");process.exit(0)}
const feed=await readJson(FEED,{items:[]}), links=await readJson(LINKS,{}), state=await readJson(STATE,{version:1,initializedAt:null,published:{}});
const items=Array.isArray(feed.items)?feed.items.filter(n=>n&&n.title&&n.source):[];
if(mode==="test"){
  const requested=process.env.TEST_SOURCE, item=items.find(n=>requested?n.source===requested:true);
  if(!item)throw new Error("No controlled test item found in assets/news-feed.json");
  try{await send(normalized(item),links);console.log("Telegram test succeeded:",cleanHeadline(item.title))}catch(error){console.error("Telegram test failed:",error.message);process.exitCode=1}process.exit();
}
if(!state.initializedAt){
  state.initializedAt=new Date().toISOString();
  for(const item of items)state.published[keyFor(item)]={status:"baseline",initializedAt:state.initializedAt};
  await mkdir("data",{recursive:true});await writeFile(STATE,JSON.stringify(state,null,2)+"\n");
  console.log("Telegram publisher initialized safely; historical news was not published.");process.exit();
}
for(const item of items.filter(n=>!state.published[keyFor(n)]&&Date.parse(n.publishedAt||0)>=Date.parse(state.initializedAt))){
  try{const post=normalized(item),delivery=await send(post,links);state.published[keyFor(item)]={status:"sent",delivery,sentAt:new Date().toISOString(),story_id:post.story_id};await mkdir("data",{recursive:true});await writeFile(STATE,JSON.stringify(state,null,2)+"\n");console.log("Telegram published:",post.headline)}catch(error){console.error("Telegram publish failed:",cleanHeadline(item.title),error.message)}
}
