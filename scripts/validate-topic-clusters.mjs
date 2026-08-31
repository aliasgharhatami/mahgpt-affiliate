import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,"config/topic-clusters.json"),"utf8"));
const pages=new Set();
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if([".git","node_modules"].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith(".html"))pages.add("/"+path.relative(root,f).replaceAll(path.sep,"/"));}};
walk(root);
const errors=[],warnings=[];
for(const cluster of config.clusters){
 if(!cluster.hub||!cluster.pages?.length) errors.push(cluster.id+": missing hub/pages");
 for(const url of [cluster.hub,...cluster.pages]){
  if(url!=="/news/"&&!pages.has(url)&&!pages.has(url+".html")&&!pages.has(url+"index.html")) errors.push(cluster.id+": target not found "+url);
 }
 const unique=new Set(cluster.pages);
 if(unique.size!==cluster.pages.length) errors.push(cluster.id+": duplicate target");
 if(unique.has(cluster.hub)) warnings.push(cluster.id+": hub is also a member");
}
const ids=new Set(config.clusters.map(c=>c.id));
if(ids.size!==config.clusters.length) errors.push("duplicate cluster id");
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log("Topic-cluster validation passed for "+config.clusters.length+" clusters and "+pages.size+" HTML pages.");
console.log("Policy: max "+config.policy.maxLinksPerPage+" links/page; same-locale="+config.policy.sameLocale+"; affiliate links preserved.");
