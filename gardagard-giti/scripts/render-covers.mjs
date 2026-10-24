import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const fmtSize = (brand, format) => {
  const d = brand.formats?.[format];
  if (!d?.width || !d?.height) throw new Error("Unsupported format: " + format);
  return d;
};
const photoURI = async filepath => {
  if (!filepath) return null;
  const ext=extname(filepath).toLowerCase();
  const mime=ext===".png"?"image/png":ext===".jpg"||ext===".jpeg"?"image/jpeg":ext===".webp"?"image/webp":null;
  if (!mime) throw new Error("Image must be PNG, JPEG or WebP");
  return "data:"+mime+";base64,"+(await readFile(resolve(filepath))).toString("base64");
};

export function renderCoverSvg(story, brand, format, imageURI=null) {
  const {width:w,height:h}=fmtSize(brand,format);
  if (!story.headlineLines?.length || story.headlineLines.length>3) throw new Error("1-3 headline lines are required");
  if (brand.tagline!=="فالو کن تا بگردیم به گرداگرد گیتی") throw new Error("The approved tagline must remain exact");
  const c=brand.colors, font=esc(brand.font || "Vazirmatn, Noto Sans Arabic, sans-serif");
  const ty=Math.round(h*brand.tagline_position.center_y);
  const headY=Math.round(h*(format==="feed"?.51:.53));
  const fontSize=format==="feed"?68:77;
  const title=story.headlineLines.map((line,i) =>
    '<text x="'+(w-76)+'" y="'+(headY+i*(fontSize+20))+'" text-anchor="end" direction="rtl" unicode-bidi="embed" font-size="'+fontSize+'" font-weight="900" fill="#fff">'+esc(line)+'</text>'
  ).join("\n");
  const photograph=imageURI
    ? '<image x="0" y="0" width="'+w+'" height="'+h+'" href="'+esc(imageURI)+'" preserveAspectRatio="xMidYMid slice"/>'
    : '<g opacity=".86"><circle cx="640" cy="535" r="330" fill="#16B8A6" opacity=".13"/><circle cx="820" cy="400" r="218" fill="#F6C65B" opacity=".13"/><circle cx="250" cy="630" r="350" fill="#FFFFFF" opacity=".03"/><path d="M160 570 Q390 300 670 560 T1150 490" fill="none" stroke="#58ECD3" stroke-width="6" opacity=".23"/><text x="820" y="650" font-size="380" text-anchor="middle" fill="#ffffff" opacity=".17" font-family="'+font+'">۳</text><text x="540" y="745" font-size="110" text-anchor="middle" opacity=".65">🐎  🐎  🐎</text></g>';
  const illustration=!imageURI?
    '<rect x="72" y="'+Math.round(h*.39)+'" width="240" height="54" rx="27" fill="#173E4C"/><text x="192" y="'+Math.round(h*.39+36)+'" text-anchor="middle" font-size="25" fill="#C2EAE9" font-family="'+font+'">تصویرسازی مفهومی</text>':
    (story.image?.illustrative?'<text x="80" y="'+Math.round(h*.415)+'" font-family="'+font+'" font-size="27" fill="#E6EFF0">تصویر تزئینی / آرشیوی</text>':"");
  const badgeText=esc(story.flag||"🌍")+"  "+esc(story.country||"جهان")+" | "+esc(story.city||"");
  const margin=brand.tagline_position.center_x*w;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+c.navy+'"/><stop offset="1" stop-color="'+c.ink+'"/></linearGradient>',
    '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0D1F2F" stop-opacity=".09"/><stop offset=".43" stop-color="#081320" stop-opacity=".14"/><stop offset=".72" stop-color="#081320" stop-opacity=".90"/><stop offset="1" stop-color="#081320"/></linearGradient></defs>',
    '<rect width="'+w+'" height="'+h+'" fill="url(#bg)"/>',
    photograph,
    '<rect width="'+w+'" height="'+h+'" fill="url(#shade)"/>',
    '<rect x="0" y="0" width="'+w+'" height="12" fill="'+c.gold+'"/>',
    '<text x="'+(w-70)+'" y="124" font-family="'+font+'" font-size="52" font-weight="900" text-anchor="end" direction="rtl" fill="'+c.white+'">'+esc(brand.name)+'</text>',
    '<rect x="70" y="78" width="210" height="65" rx="30" fill="'+c.teal+'"/><text x="175" y="120" font-size="28" fill="'+c.ink+'" font-weight="800" font-family="'+font+'" text-anchor="middle">خبر محلی</text>',
    '<rect x="'+(w-440)+'" y="174" width="370" height="68" rx="30" fill="#102B40" fill-opacity=".88" stroke="#3A6476"/>',
    '<text x="'+(w-255)+'" y="219" font-family="'+font+'" text-anchor="middle" direction="rtl" font-size="33" fill="#FFFFFF">'+badgeText+'</text>',
    illustration,
    '<text x="'+(w-75)+'" y="'+Math.round(h*.46)+'" font-family="'+font+'" text-anchor="end" direction="rtl" font-size="35" fill="'+c.gold+'">'+esc(story.kicker||"از گوشه‌وکنار جهان")+'</text>',
    title,
    '<rect x="65" y="'+(ty-67)+'" width="950" height="134" rx="42" fill="'+c.teal+'"/>',
    '<text x="'+margin+'" y="'+(ty+13)+'" font-family="'+font+'" text-anchor="middle" direction="rtl" unicode-bidi="embed" font-size="39" font-weight="900" fill="'+c.ink+'">'+esc(brand.tagline)+'</text>',
    '<path d="M70 '+(h-169)+' H1010" stroke="#FFFFFF" opacity=".17"/>',
    '<text x="'+(w-72)+'" y="'+(h-102)+'" font-family="'+font+'" font-size="26" text-anchor="end" direction="rtl" fill="#DFE8ED">منبع: '+esc(story.source?.publisher||"")+' | '+esc(story.eventDate||"")+'</text>',
    '<text x="74" y="'+(h-102)+'" font-family="'+font+'" font-size="25" fill="#9FB5C5">GARDAGARD GITI</text>',
    '</svg>'
  ].join("\n");
  if (!svg.includes(brand.tagline)) throw new Error("Tagline was omitted");
  return svg;
}

export async function renderAll(story, brand, outputDir="gardagard-giti/output") {
  await mkdir(outputDir,{recursive:true});
  const img=await photoURI(story.image?.path || null);
  const outputs=[];
  let sharp=null;
  try { sharp=(await import("sharp")).default; } catch(e) { console.warn("sharp unavailable: SVG previews only",e.message); }
  for (const format of ["reel","feed","story"]) {
    const svg=renderCoverSvg(story,brand,format,img);
    const base=join(outputDir,story.id+"-"+format);
    await writeFile(base+".svg",svg,"utf8");
    outputs.push(base+".svg");
    if(sharp) {
      await sharp(Buffer.from(svg)).png().toFile(base+".png");
      outputs.push(base+".png");
    }
  }
  return outputs;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const fixture=resolve(process.argv[2]||"gardagard-giti/stories/2026-10-19-edirne-horses.json");
  const brandFile=resolve("gardagard-giti/config/brand.json");
  const [story,brand]=await Promise.all([readFile(fixture,"utf8").then(JSON.parse),readFile(brandFile,"utf8").then(JSON.parse)]);
  const out=process.argv[3]||"gardagard-giti/output";
  console.log((await renderAll(story,brand,out)).join("\n"));
}
