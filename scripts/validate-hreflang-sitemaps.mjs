import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const base='https://mahgpt.com';
const config=JSON.parse(fs.readFileSync(path.join(root,'config/locales.json'),'utf8'));
const locales=config.supported;
const localeCodes=new Set(locales.map(item=>item.code));
const errors=[];
const sitemapSlug=code=>code.toLowerCase();
function walk(dir,out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='dist') continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full,out);
    else if(entry.isFile()&&entry.name.endsWith('.html')) out.push(path.relative(root,full).replaceAll(path.sep,'/'));
  }
  return out;
}
const isNoindex=html=>/<meta\b[^>]*(?:name|property)=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)||/<meta\b[^>]*content=["'][^"']*noindex[^"']*["'][^>]*(?:name|property)=["']robots["']/i.test(html);
const files=walk(root);
const pages=new Map(files.map(rel=>[rel,fs.readFileSync(path.join(root,rel),'utf8')]));
const indexable=new Map([...pages].filter(([,html])=>!isNoindex(html)));
const localPath=url=>{
  try{const parsed=new URL(url,base); if(parsed.origin!==base) return null; const value=parsed.pathname.replace(/^\/+/, ''); return value||'index.html';}
  catch{return null;}
};
const resolve=url=>{
  const value=localPath(url);
  if(!value) return null;
  if(indexable.has(value)) return value;
  if(indexable.has(value+'.html')) return value+'.html';
  if(value.endsWith('/')&&indexable.has(value+'index.html')) return value+'index.html';
  return null;
};
const attrs=tag=>{const out={}; for(const match of tag.matchAll(/([:\w-]+)=["']([^"']*)["']/g)) out[match[1].toLowerCase()]=match[2]; return out;};
const alternates=new Map();
for(const [rel,html] of indexable){
  const links=[];
  for(const match of html.matchAll(/<link\b[^>]*>/gi)){
    const a=attrs(match[0]);
    if((a.rel||'').toLowerCase().split(/\s+/).includes('alternate')&&a.hreflang&&a.href) links.push({lang:a.hreflang,url:a.href});
  }
  alternates.set(rel,links);
  const partner=rel.match(/^(?:(.+)\/)?partners\/([^/]+)\.html$/);
  if(!partner) continue;
  const code=partner[1]||'en';
  if(!localeCodes.has(code)) errors.push(rel+': unknown locale path');
  const canonical=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
  const expected=base+'/'+(code==='en'?'':code+'/')+'partners/'+partner[2]+'.html';
  if(canonical!==expected) errors.push(rel+': canonical must be '+expected);
  const wanted=new Set([...locales.map(item=>item.hreflang),'x-default']);
  const got=new Set(links.map(item=>item.lang));
  for(const lang of wanted) if(!got.has(lang)) errors.push(rel+': missing hreflang '+lang);
  for(const link of links){
    const target=resolve(link.url);
    if(!target) errors.push(rel+': hreflang target unavailable '+link.url);
    else if(target!==rel&&!alternates.get(target)?.some(item=>resolve(item.url)===rel)) errors.push(rel+': hreflang not reciprocal for '+link.url);
  }
}
const expectedFor=code=>[...indexable.keys()].filter(rel=>{const first=rel.split('/')[0]; return (localeCodes.has(first)?first:'en')===code;}).map(rel=>rel==='index.html'?'/':'/'+rel).sort();
const parseLocs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
const indexFile=path.join(root,'sitemap.xml');
if(!fs.existsSync(indexFile)) errors.push('sitemap.xml: missing');
else{
  const locs=parseLocs(fs.readFileSync(indexFile,'utf8'));
  const expected=new Set(locales.map(item=>base+'/sitemaps/sitemap-'+sitemapSlug(item.code)+'.xml'));
  for(const loc of expected) if(!locs.includes(loc)) errors.push('sitemap.xml: missing '+loc);
  for(const loc of locs) if(!expected.has(loc)) errors.push('sitemap.xml: unexpected sitemap '+loc);
}
for(const locale of locales){
  const file=path.join(root,'sitemaps','sitemap-'+sitemapSlug(locale.code)+'.xml');
  if(!fs.existsSync(file)){errors.push(locale.code+': sitemap missing');continue;}
  const locs=parseLocs(fs.readFileSync(file,'utf8'));
  const seen=new Set();
  for(const loc of locs){
    if(seen.has(loc)) errors.push(locale.code+': duplicate URL '+loc);
    seen.add(loc);
    const target=resolve(loc);
    if(!target) errors.push(locale.code+': sitemap URL unavailable '+loc);
    const first=target?.split('/')[0];
    const targetCode=target?(localeCodes.has(first)?first:'en'):null;
    if(targetCode!==locale.code) errors.push(locale.code+': URL is in wrong locale sitemap '+loc);
  }
  const expected=expectedFor(locale.code);
  const actual=[...seen].map(localPath).filter(Boolean).sort();
  const wanted=expected.map(localPath).filter(Boolean).sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted)) errors.push(locale.code+': sitemap does not match indexable pages');
}
if(errors.length){console.error('Hreflang/sitemap validation failed');console.error(errors.join('\n'));process.exit(1);}
console.log('Hreflang and sitemap validation passed for '+indexable.size+' indexable HTML pages.');