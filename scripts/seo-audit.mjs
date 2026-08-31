import fs from "node:fs";
import path from "node:path";

const root=process.cwd(), htmlFiles=[], errors=[], warnings=[];
const ignoredDirs=new Set(["node_modules",".git","dist","assets/social-cards"]);
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignoredDirs.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else if(entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(root);
const rel=file=>path.relative(root,file).replaceAll(path.sep,"/");
const pages=new Set(htmlFiles.map(rel));
const titles=new Map(), canonicals=new Map(), hreflangTargets=[];
const existsTarget=(href,from)=>{
  if(!href || /^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return true;
  const clean=href.split("#")[0].split("?")[0];
  if(!clean) return true;
  const normalized=clean.startsWith("/")?clean.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(rel(from)),clean));
  if(normalized.endsWith("/")) return pages.has(normalized+"index.html");
  return pages.has(normalized) || pages.has(normalized+".html");
};
for(const file of htmlFiles){
  const name=rel(file), html=fs.readFileSync(file,"utf8");
  const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
  const desc=html.match(/<meta[^>]+(?:name|property)=["']description["'][^>]+content=["'][^"']+["']/i)||html.match(/<meta[^>]+content=["'][^"']+["'][^>]+(?:name|property)=["']description["']/i);
  const canonical=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]||"";
  if(!title) errors.push(name+": missing title");
  if(!desc) warnings.push(name+": missing meta description");
  if(!canonical) warnings.push(name+": missing canonical");
  if(!/<h1\b/i.test(html)) warnings.push(name+": missing h1");
  if(!/<meta[^>]+property=["']og:title["']/i.test(html)) warnings.push(name+": missing og:title");
  if(!/<meta[^>]+property=["']og:description["']/i.test(html)) warnings.push(name+": missing og:description");
  if(!/<meta[^>]+name=["']twitter:card["']/i.test(html)) warnings.push(name+": missing twitter:card");
  for(const m of html.matchAll(/<img\b[^>]*>/gi)) if(!/\balt=["'][^"']*["']/i.test(m[0])) errors.push(name+": image missing alt");
  for(const m of html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)) if(!existsTarget(m[1],file)) warnings.push(name+": broken local link "+m[1]);
  for(const m of html.matchAll(/<link[^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi)) hreflangTargets.push([name,m[1],m[2]]);
  if(title){if(!titles.has(title))titles.set(title,[]);titles.get(title).push(name);}
  if(canonical){if(!canonicals.has(canonical))canonicals.set(canonical,[]);canonicals.get(canonical).push(name);}
}
for(const [t,files] of titles) if(files.length>1) warnings.push("duplicate title ("+files.length+"): "+t);
for(const [c,files] of canonicals) if(files.length>1) warnings.push("duplicate canonical ("+files.length+"): "+c);
for(const [from,lang,url] of hreflangTargets) if(url.startsWith("https://mahgpt.com/") && !url.includes("#")) {
  const local=url.replace("https://mahgpt.com/","");
  if(!pages.has(local) && !pages.has(local+".html")) warnings.push(from+": hreflang target not found "+url);
}
const robots=fs.existsSync("robots.txt")?fs.readFileSync("robots.txt","utf8"):"";
if(!/Sitemap:\s*https:\/\/mahgpt\.com\/sitemap\.xml/i.test(robots)) errors.push("robots.txt: missing sitemap");
for(const bot of ["Googlebot","Bingbot","OAI-SearchBot"]) if(!new RegExp(bot,"i").test(robots)) warnings.push("robots.txt: "+bot+" not explicit");
const sitemap=fs.existsSync("sitemap.xml")?fs.readFileSync("sitemap.xml","utf8"):"";
if(!sitemap.includes("https://mahgpt.com/")) errors.push("sitemap.xml: no MahGPT URLs");
if(errors.length){console.error("SEO audit failed");console.error(errors.join("\n"));process.exit(1);}
console.log("SEO audit passed for "+htmlFiles.length+" HTML pages.");
if(warnings.length){console.log("Warnings:");console.log(warnings.slice(0,120).join("\n"));if(warnings.length>120)console.log("... "+(warnings.length-120)+" more");}
