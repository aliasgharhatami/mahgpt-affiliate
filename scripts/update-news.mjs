import { writeFile } from "node:fs/promises";

const feeds = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://venturebeat.com/category/ai/feed/",
  "https://www.wired.com/feed/tag/ai/latest/rss",
  "https://www.theverge.com/rss/index.xml",
  "https://news.google.com/rss/search?q=(Adobe+Firefly+OR+ElevenLabs+OR+Descript+OR+InVideo+OR+Hostinger+OR+Semrush+OR+Surfer+OR+Jasper+OR+Canva+AI+OR+Runway+OR+HeyGen+OR+Perplexity+OR+Notion+AI)+AI&hl=en-US&gl=US&ceid=US:en"
];

const partners = [
  ["adobe","Adobe",["adobe","firefly"],"/partners/adobe.html","/assets/logos/adobe.svg"],
  ["elevenlabs","ElevenLabs",["elevenlabs","eleven labs"],"/tools/elevenlabs.html","/assets/logos/elevenlabs.svg"],
  ["descript","Descript",["descript"],"/partners/descript.html","/assets/logos/descript.svg"],
  ["invideo","InVideo",["invideo"],"/partners/invideo.html","/assets/logos/invideo.svg"],
  ["hostinger","Hostinger",["hostinger","horizons"],"/partners/hostinger.html","/assets/logos/hostinger.svg"],
  ["semrush","Semrush",["semrush"],"/partners/semrush.html","/assets/logos/semrush.svg"],
  ["surfer","Surfer",["surferseo","surfer"],"/partners/surfer.html","/assets/logos/surfer.svg"],
  ["jasper","Jasper",["jasper"],"/tools/jasper.html","/assets/logos/jasper.svg"],
  ["canva","Canva AI",["canva","firefly"],"/tools/canva.html","/assets/logos/canva.svg"],
  ["runway","Runway",["runway"],"/tools/runway.html","https://img.youtube.com/vi/ei2PsDpPbB4/maxresdefault.jpg"],
  ["create-music-ai","Create Music AI",["create music ai"],"/partners/create-music-ai.html","/assets/logos/create-music-ai.svg"],
  ["soundraw","SOUNDRAW",["soundraw"],"/partners/soundraw.html","/assets/logos/soundraw.svg"],
  ["steve-ai","Steve AI",["steve ai"],"/partners/steve-ai.html","/assets/logos/steve-ai.svg"],
  ["heygen","HeyGen",["heygen"],"/partners/heygen.html","/assets/logos/heygen.svg"],
  ["perplexity","Perplexity",["perplexity"],"/partners/perplexity.html","/assets/logos/perplexity.svg"],
  ["notion","Notion AI",["notion ai","notion"],"/partners/notion.html","/assets/logos/notion.svg"]
];

const decode = (s="") => s.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
const tag = (block,name) => decode(block.match(new RegExp("<"+name+"[^>]*>([\\s\\S]*?)</"+name+">","i"))?.[1] || "");
const attr = (block,names) => {
  for (const name of names) {
    const m=block.match(new RegExp("<(?:media:content|media:thumbnail|enclosure)[^>]*"+name+"=['"]([^'"]+)['"]","i"));
    if(m)return m[1];
  }
  return "";
};
const items=[];
for(const url of feeds){
  try{
    const res=await fetch(url,{headers:{"user-agent":"MahGPT-NewsBot/1.0"}});
    if(!res.ok)continue;
    const xml=await res.text();
    const blocks=[...xml.matchAll(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/gi)].map(m=>m[0]);
    for(const block of blocks){
      const title=tag(block,"title"), summary=tag(block,"description")||tag(block,"summary"), link=tag(block,"link")||block.match(/<link[^>]+href=['"]([^'"]+)['"]/i)?.[1]||"", published=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated"), text=(title+" "+summary).toLowerCase();
      const partner=partners.find(p=>p[2].some(k=>text.includes(k)));
      if(!partner||!title||!link)continue;
      items.push({tool:partner[0],toolName:partner[1],category:"AI news",title,summary:summary.slice(0,260),guide:partner[3],source:link,publishedAt:new Date(published||Date.now()).toISOString(),image:attr(block,["url"])||partner[4]});
    }
  }catch(error){ console.warn("Feed failed",url,error.message); }
}
const unique=[...new Map(items.map(x=>[x.source,x])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,30);
const output={updatedAt:new Date().toISOString(),sources:feeds,items:unique.length>=10?unique:unique.slice(0,10)};
await writeFile("assets/news-feed.json",JSON.stringify(output,null,2)+"\n");
console.log("MahGPT news items:",output.items.length);
