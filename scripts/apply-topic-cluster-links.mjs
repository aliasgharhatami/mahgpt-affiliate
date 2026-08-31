import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const cfg=JSON.parse(fs.readFileSync("config/topic-clusters.json","utf8"));
const label=u=>u.replace(/\/$/,"").split("/").pop().replace(/\.html$/,"").replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const locales=["en","es","de","fr","pt-BR","ar","fa","tr","it","ja","ko","id","hi"];
const localize=(url,locale)=>{
 if(locale==="en") return url;
 if(url==="/news/") return "/"+locale+"/news/";
 return "/"+locale+url;
};
const files=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if([".git","node_modules","assets"].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith(".html"))files.push("/"+path.relative(root,f).replaceAll(path.sep,"/"));}};
walk(root);
for(const locale of locales){
 for(const cluster of cfg.clusters){
  const members=[cluster.hub,...cluster.pages].filter((v,i,a)=>a.indexOf(v)===i);
  for(const base of members){
   const file="/"+(locale==="en"?"":locale+"/")+base.slice(1);
   let disk=path.join(root,file.slice(1));
   if(fs.existsSync(disk)&&fs.statSync(disk).isDirectory()) disk=path.join(disk,"index.html");
   if(!fs.existsSync(disk))continue;
   let html=fs.readFileSync(disk,"utf8");
   if(html.includes('data-topic-cluster="'+cluster.id+'"'))continue;
   const related=members.filter(v=>v!==base).slice(0,cfg.policy.maxLinksPerPage);
   if(!related.length)continue;
   const nav='<nav class="topic-links" data-topic-cluster="'+cluster.id+'" aria-label="Related MahGPT pages"><strong>Related:</strong> '+related.map(v=>'<a href="'+localize(v,locale)+'">'+label(v)+'</a>').join(" · ")+"</nav>";
   const marker=/<\/main>/i;
   if(marker.test(html)) html=html.replace(marker,nav+"</main>");
   else if(/<\/body>/i.test(html)) html=html.replace(/<\/body>/i,nav+"</body>");
   else continue;
   fs.writeFileSync(disk,html);
  }
 }
}
console.log("Applied conservative topic-cluster links without touching headings or affiliate URLs.");
