import { writeFile } from "node:fs/promises";

const feeds = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://venturebeat.com/category/ai/feed/",
  "https://www.wired.com/feed/tag/ai/latest/rss",
  "https://www.theverge.com/rss/index.xml",
  "https://www.techradar.com/rss",
  "https://www.macworld.com/feed",
  "https://www.creativebloq.com/feed",
  "https://www.artificialintelligence-news.com/feed/",
  "https://news.google.com/rss/search?q=(Adobe+Firefly+OR+ElevenLabs+OR+Descript+OR+InVideo+OR+Hostinger+OR+Semrush+OR+Surfer+OR+Jasper+OR+Canva+AI+OR+Runway+OR+Create+Music+AI+OR+SOUNDRAW+OR+HeyGen+OR+Fliki+OR+AdCreative+OR+Pictory)+AI&hl=en-US&gl=US&ceid=US:en",
  ...partners.map(p=>`https://news.google.com/rss/search?q=${encodeURIComponent(p[1])}+AI&hl=en-US&gl=US&ceid=US:en`),
];

const partners = [
  ["adobe","Adobe",["adobe","firefly"],"/partners/adobe.html"],
  ["elevenlabs","ElevenLabs",["elevenlabs","eleven labs"],"/partners/elevenlabs.html"],
  ["descript","Descript",["descript"],"/partners/descript.html"],
  ["invideo","InVideo",["invideo"],"/partners/invideo.html"],
  ["hostinger","Hostinger",["hostinger"],"/partners/hostinger.html"],
  ["horizons","Hostinger Horizons",["horizons"],"/partners/horizons.html"],
  ["semrush","Semrush",["semrush"],"/partners/semrush.html"],
  ["surfer","Surfer",["surferseo","surfer"],"/partners/surfer.html"],
  ["jasper","Jasper",["jasper"],"/partners/jasper.html"],
  ["canva","Canva AI",["canva"],"/partners/canva.html"],
  ["runway","Runway",["runway"],"/partners/runway.html"],
  ["create-music-ai","Create Music AI",["create music ai"],"/partners/create-music-ai.html"],
  ["soundraw","SOUNDRAW",["soundraw"],"/partners/soundraw.html"],
  ["heygen","HeyGen",["heygen"],"/partners/heygen.html"],
  ["fliki","Fliki",["fliki"],"/partners/fliki.html"],
  ["adcreative","AdCreative.ai",["adcreative"],"/partners/adcreative.html"],
  ["pictory","Pictory",["pictory"],"/partners/pictory.html"]
];

const decode = (s="") => s
  .replace(/<!\[CDATA\[|\]\]>/g,"")
  .replace(/<[^>]+>/g," ")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"')
  .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<")
  .replace(/&gt;/g,">").replace(/&#x2F;/g,"/")
  .replace(/\s+/g," ").trim();

const tag = (block,name) => decode(
  block.match(new RegExp("<"+name+"[^>]*>([\\s\\S]*?)</"+name+">","i"))?.[1] || ""
);

const attr = (block,names) => {
  for (const name of names) {
    const m=block.match(new RegExp("<(?:media:content|media:thumbnail|enclosure)[^>]*"+name+"=['\"]([^'\"]+)['\"]","i"));
    if(m)return m[1];
  }
  return "";
};

const absoluteUrl = (value,base) => {
  try { return new URL(value,base).href; } catch { return ""; }
};

const articleImage = async (url) => {
  try {
    const res=await fetch(url,{headers:{"user-agent":"MahGPT-NewsBot/1.0"},redirect:"follow"});
    if(!res.ok)return "";
    const html=await res.text();
    const patterns=[
      /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i
    ];
    for(const pattern of patterns){
      const match=html.match(pattern);
      if(match)return absoluteUrl(decode(match[1]),url);
    }
  } catch {}
  return "";
};

const youtubeImage = (url) => {
  const match=String(url).match(/[?&]v=([^&]+)/) || String(url).match(/youtu\.be\/([^?]+)/);
  return match ? "https://img.youtube.com/vi/"+match[1]+"/hqdefault.jpg" : "";
};

const partnerFor = (text) => partners.find(p=>p[2].some(k=>text.includes(k)));

const collected=[];
for(const feedUrl of feeds){
  try{
    const res=await fetch(feedUrl,{headers:{"user-agent":"MahGPT-NewsBot/1.0"},redirect:"follow"});
    if(!res.ok)continue;
    const xml=await res.text();
    const blocks=[...xml.matchAll(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi)].map(m=>m[0]);
    for(const block of blocks){
      const title=tag(block,"title");
      const summary=tag(block,"description")||tag(block,"summary")||tag(block,"content");
      const link=absoluteUrl(
        tag(block,"link") ||
        block.match(/<link[^>]+href=['"]([^'"]+)['"]/i)?.[1] || "",
        feedUrl
      );
      const published=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||tag(block,"date");
      const time=Date.parse(published);
      if(!title||!link||!Number.isFinite(time))continue;
      const text=(title+" "+summary).toLowerCase();
      const partner=partnerFor(text);
      const generalAI=/\b(ai|artificial intelligence|agentic|generative|machine learning|large language model|voice ai|video ai|text-to-image|text-to-video)\b/i.test(text);
      if(!partner&&!generalAI)continue;
      const media=absoluteUrl(attr(block,["url"]),link)||youtubeImage(link);
      collected.push({
        partner,
        title:decode(title),
        summary:decode(summary).slice(0,300),
        link,
        publishedAt:new Date(time).toISOString(),
        media
      });
    }
  }catch(error){
    console.warn("Feed failed",feedUrl,error.message);
  }
}

const cutoff=Date.now()-7*24*60*60*1000;
const fresh=[...new Map(collected.map(x=>[x.link,x])).values()]
  .filter(x=>Date.parse(x.publishedAt)>=cutoff)
  .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));

const hydrate=async (item) => {
  const image=await articleImage(item.link)||item.media||"";
  const partner=item.partner;
  return {
    tool:partner?.[0]||"ai-news",
    toolName:partner?.[1]||"AI News",
    category:partner ? "Partner watch" : "AI news",
    title:item.title,
    summary:item.summary||"A fresh development from the fast-moving AI tools ecosystem.",
    guide:partner?.[3]||"/news/index.html",
    source:item.link,
    publishedAt:item.publishedAt,
    image
  };
};

// Round-robin partner coverage: one fresh story per partner first,
// then fill remaining slots with the strongest recent stories.
const grouped=new Map();
for(const item of fresh){
  const key=item.partner?.[0]||"ai-news";
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(item);
}
const selected=[];
for(const partner of partners){
  const item=grouped.get(partner[0])?.[0];
  if(item)selected.push(item);
}
for(const item of fresh){
  if(selected.length>=10)break;
  if(!selected.includes(item))selected.push(item);
}
const hydrated=[];
for(const item of selected.slice(0,10))hydrated.push(await hydrate(item));
const output={
  updatedAt:new Date().toISOString(),
  freshnessWindow:"7 days",
  sources:feeds,
  items:hydrated
};

await writeFile("assets/news-feed.json",JSON.stringify(output,null,2)+"\n");
console.log("MahGPT fresh news items:",output.items.length);
