import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const htmlFiles=[];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(["node_modules",".git","dist"].includes(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else if(entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(root);
const errors=[], warnings=[], titles=new Map(), canonicals=new Map();
for(const file of htmlFiles){
  const rel=path.relative(root,file).replaceAll(path.sep,"/");
  const html=fs.readFileSync(file,"utf8");
  const title=(html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]||"").replace(/<[^>]+>/g,"").trim();
  const description=html.match(/<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i)||html.match(/<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i);
  const canonical=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]||"";
  if(!title) errors.push(rel+": missing title");
  if(!description) warnings.push(rel+": missing meta description");
  if(!canonical) warnings.push(rel+": missing canonical");
  if(!/<h1\\b/i.test(html)) warnings.push(rel+": missing h1");
  for(const m of html.matchAll(/<img\\b[^>]*>/gi)) if(!/\\balt=["'][^"']*["']/i.test(m[0])) errors.push(rel+": image missing alt");
  if(title){if(!titles.has(title))titles.set(title,[]);titles.get(title).push(rel);}
  if(canonical){if(!canonicals.has(canonical))canonicals.set(canonical,[]);canonicals.get(canonical).push(rel);}
}
for(const [title,files] of titles) if(files.length>1) warnings.push("duplicate title: "+title+" ("+files.length+" pages)");
for(const [url,files] of canonicals) if(files.length>1) warnings.push("duplicate canonical: "+url+" ("+files.length+" pages)");
const robots=fs.existsSync("robots.txt")?fs.readFileSync("robots.txt","utf8"):"";
if(!/Sitemap:\\s*https:\\/\\/mahgpt\\.com\\/sitemap\\.xml/i.test(robots)) errors.push("robots.txt: missing canonical sitemap");
if(!/OAI-SearchBot/i.test(robots)) warnings.push("robots.txt: OAI-SearchBot is not explicitly declared");
const sitemap=fs.existsSync("sitemap.xml")?fs.readFileSync("sitemap.xml","utf8"):"";
if(!sitemap.includes("https://mahgpt.com/")) errors.push("sitemap.xml: no MahGPT URLs found");
if(errors.length){console.error("SEO validation failed");console.error(errors.join("\\n"));process.exit(1);}
console.log("SEO validation passed for "+htmlFiles.length+" HTML pages.");
if(warnings.length){console.log("Warnings:");console.log(warnings.slice(0,40).join("\\n"));if(warnings.length>40)console.log("... "+(warnings.length-40)+" more");}
