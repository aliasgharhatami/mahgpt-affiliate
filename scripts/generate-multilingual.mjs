import fs from "node:fs"; import path from "node:path";
const root=process.cwd(), base="https://mahgpt.com";
const locales=JSON.parse(fs.readFileSync(path.join(root,"config/locales.json"),"utf8"));
const labels={
 en:["AI tool guide","What it is","Who it is for","How it works","Read the English guide"],
 es:["Guía de herramientas de IA","Qué es","Para quién es","Cómo funciona","Leer la guía en inglés"],
 de:["Leitfaden für KI-Tools","Was ist es?","Für wen ist es?","So funktioniert es","Englischen Leitfaden lesen"],
 fr:["Guide des outils d’IA","Présentation","Pour qui ?","Comment ça marche","Lire le guide en anglais"],
 "pt-BR":["Guia de ferramentas de IA","O que é","Para quem é","Como funciona","Ler o guia em inglês"],
 ar:["دليل أدوات الذكاء الاصطناعي","ما هو؟","لمن يناسب؟","كيف يعمل؟","قراءة الدليل بالإنجليزية"],
 fa:["راهنمای ابزارهای هوش مصنوعی","این ابزار چیست؟","برای چه کسانی است؟","چگونه کار می‌کند؟","مطالعه راهنمای انگلیسی"],
 tr:["Yapay zekâ araçları rehberi","Nedir?","Kimler için?","Nasıl çalışır?","İngilizce rehberi oku"],
 it:["Guida agli strumenti IA","Che cos’è","Per chi è","Come funziona","Leggi la guida in inglese"],
 ja:["AIツールガイド","概要","対象ユーザー","使い方","英語ガイドを読む"],
 ko:["AI 도구 가이드","무엇인가요?","누구를 위한 도구인가요?","사용 방법","영문 가이드 읽기"],
 id:["Panduan alat AI","Apa itu?","Untuk siapa?","Cara kerjanya","Baca panduan bahasa Inggris"],
 hi:["AI टूल गाइड","यह क्या है?","किसके लिए है?","यह कैसे काम करता है?","अंग्रेज़ी गाइड पढ़ें"]
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const partnerFiles=fs.readdirSync(path.join(root,"partners")).filter(x=>x.endsWith(".html"));
function titleOf(html,file){const m=html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i); return (m?m[1]:path.basename(file,".html")).replace(/\\s+/g," ").trim().replace(/\\s*[|–-].*$/,"");}
function hrefOf(html){const m=html.match(/data-affiliate-slot="[^"]+" href="([^"]+)"/i); return m?m[1]:"/"; }
function page(locale,slug,name,source,href){
 const l=labels[locale.code]||labels.en, rtl=locale.dir==="rtl";
 const links=locales.supported.map(x=>{const u=x.code==="en"?"/partners/"+slug:"/"+x.code+"/partners/"+slug; return `<link rel="alternate" hreflang="${x.hreflang}" href="${base}${u}">`;}).join("\n");
 const selector=locales.supported.map(x=>`<a href="${x.code==="en"?"/partners/"+slug:"/"+x.code+"/partners/"+slug}">${esc(x.name)}</a>`).join(" · ");
 const desc=locale.code==="en"?`An independent MahGPT guide to ${name}: key features, practical uses, workflow, and what to check before choosing it.`:`${name} — ${l[0]}. Découvrez les fonctionnalités, les usages et les points à vérifier avant de choisir cet outil.`;
 return `<!doctype html><html lang="${locale.hreflang}" dir="${rtl?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} — ${esc(l[0])} | MahGPT</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${base}/${locale.code==="en"?"partners/":locale.code+"/partners/"}${slug}">${links}\n<link rel="alternate" hreflang="x-default" href="${base}/partners/${slug}"><meta property="og:locale" content="${locale.hreflang}"><style>body{font-family:system-ui,sans-serif;max-width:850px;margin:auto;padding:32px;line-height:1.7;color:#17152b}a{color:#5d35d5}.langs{font-size:.9em;margin-bottom:28px;padding:12px;border-bottom:1px solid #ddd}.cta{display:inline-block;background:#5d35d5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none}main{max-width:720px}h1{line-height:1.15}</style></head><body><div class="langs"><strong>MahGPT</strong> · ${selector}</div><main><p>${esc(l[0])}</p><h1>${esc(name)}</h1><p>${esc(locale.code==="en"?`This MahGPT editorial page explains what ${name} does, the problems it can solve, and how to evaluate it before subscribing.`:`${name} est un outil présenté par MahGPT pour créer un flux de travail plus simple et plus efficace. Cette page résume ses usages principaux et les éléments à vérifier avant un abonnement.`)}</p><h2>${esc(l[1])}</h2><p>${esc(name)} is a software product for creators, teams, and professionals who want to complete digital work with less friction. Official product names and links are preserved.</p><h2>${esc(l[2])}</h2><p>It may be useful for individuals, creators, small businesses, and teams whose needs match the product’s current features and terms.</p><h2>${esc(l[3])}</h2><p>Start with a specific task, test the available workflow, review current pricing and limitations, then decide whether it fits your work.</p><p><a class="cta" href="${esc(href)}" target="_blank" rel="sponsored noopener">${esc(name)} ↗</a></p><p><a href="/partners/${slug}">${esc(l[4])}</a></p></main></body></html>`;
}
for(const file of partnerFiles){const slug=file.replace(/\\.html$/,""), source=fs.readFileSync(path.join(root,"partners",file),"utf8"), name=titleOf(source,file), href=hrefOf(source); for(const locale of locales.supported.filter(x=>x.code!=="en")){const dir=path.join(root,locale.code,"partners"); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,file),page(locale,slug,name,source,href));}}
console.log(`Generated localized partner pages for ${partnerFiles.length} partners × ${locales.supported.length-1} languages. Provider mode: static; no external API used.`);
