import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const base='https://mahgpt.com';
const config=JSON.parse(fs.readFileSync(path.join(root,'config/locales.json'),'utf8'));
const locales=config.supported;
const localeCodes=new Set(locales.map(item=>item.code));
const sitemapSlug=code=>code.toLowerCase();
const xmlEscape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
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
const pages=walk(root).filter(rel=>{
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  return !/<meta\\b[^>]*(?:name|property)=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)&&!/<meta\\b[^>]*content=["'][^"']*noindex[^"']*["'][^>]*(?:name|property)=["']robots["']/i.test(html);
}).sort();
const urlFor=rel=>rel==='index.html'?'/':'/'+rel;
const byLocale=Object.fromEntries(locales.map(locale=>[locale.code,[]]));
for(const rel of pages){
  const first=rel.split('/')[0];
  const code=localeCodes.has(first)?first:'en';
  byLocale[code].push(urlFor(rel));
}
const write=(file,content)=>fs.writeFileSync(path.join(root,file),content+'\\n');
for(const locale of locales){
  const body=byLocale[locale.code].map(url=>'<url><loc>'+xmlEscape(base+url)+'</loc></url>').join('');
  write('sitemaps/sitemap-'+sitemapSlug(locale.code)+'.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+body+'</urlset>');
}
const indexBody=locales.map(locale=>'<sitemap><loc>'+base+'/sitemaps/sitemap-'+sitemapSlug(locale.code)+'.xml</loc></sitemap>').join('');
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+indexBody+'</sitemapindex>');
console.log('Generated '+locales.length+' locale sitemaps from '+pages.length+' indexable HTML pages.');