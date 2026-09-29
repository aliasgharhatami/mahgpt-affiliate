import { readFile, writeFile } from "node:fs/promises";

const redirect = "/go/invideo.html";
const locales = ["en", "es", "de", "fr", "pt-BR", "ar", "fa", "tr", "it", "ja", "ko", "id", "hi"];

const copy = {
  en: {
    heading: "InVideo AI v4.0: avatars, UGC ads and faster video production",
    intro: "InVideo AI can turn a written brief into a structured video draft with a script, scenes, voiceover, captions and music. Its v4.0 workflow also introduced AI Twins and AI Actors for avatar-led and UGC-style product videos.",
    points: ["Test text-to-video and faceless YouTube workflows from one brief.", "Create an AI Twin or use an AI Actor for presenter-led videos.", "Build product and UGC-style ads without coordinating a full shoot.", "Review language, voice, stock rights, credits and export limits before publishing."],
    cta: "Try InVideo AI",
    disclosure: "Affiliate disclosure: MahGPT may earn a commission if you buy through this link, at no extra cost to you."
  },
  es: {
    heading: "InVideo AI v4.0: avatares, anuncios UGC y producción de vídeo más rápida",
    intro: "InVideo AI convierte una idea escrita en un borrador de vídeo con guion, escenas, voz, subtítulos y música. El flujo v4.0 también incorporó AI Twins y AI Actors para vídeos con avatar y anuncios UGC de productos.",
    points: ["Prueba texto a vídeo y vídeos de YouTube sin rostro desde un solo brief.", "Crea un AI Twin o utiliza un AI Actor como presentador.", "Produce anuncios de producto y estilo UGC sin organizar una grabación completa.", "Comprueba idioma, voz, derechos del contenido, créditos y límites de exportación."],
    cta: "Probar InVideo AI",
    disclosure: "Aviso de afiliación: MahGPT puede recibir una comisión si compras mediante este enlace, sin coste adicional para ti."
  },
  de: {
    heading: "InVideo AI v4.0: Avatare, UGC-Anzeigen und schnellere Videoproduktion",
    intro: "InVideo AI verwandelt ein schriftliches Briefing in einen Videoentwurf mit Skript, Szenen, Voiceover, Untertiteln und Musik. Der v4.0-Workflow führte außerdem AI Twins und AI Actors für Avatar- und UGC-Produktvideos ein.",
    points: ["Teste Text-zu-Video und faceless YouTube-Workflows aus einem Briefing.", "Erstelle einen AI Twin oder nutze einen AI Actor als Moderator.", "Produziere Produkt- und UGC-Anzeigen ohne vollständigen Dreh.", "Prüfe Sprache, Stimme, Medienrechte, Credits und Exportgrenzen."],
    cta: "InVideo AI testen",
    disclosure: "Affiliate-Hinweis: MahGPT kann bei einem Kauf über diesen Link eine Provision erhalten, ohne Mehrkosten für dich."
  },
  fr: {
    heading: "InVideo AI v4.0 : avatars, publicités UGC et production vidéo accélérée",
    intro: "InVideo AI transforme un brief écrit en brouillon vidéo avec script, scènes, voix off, sous-titres et musique. Le flux v4.0 a aussi introduit les AI Twins et AI Actors pour les vidéos avec avatar et les publicités produit de style UGC.",
    points: ["Testez le texte-vers-vidéo et les vidéos YouTube sans visage à partir d’un brief.", "Créez un AI Twin ou utilisez un AI Actor comme présentateur.", "Produisez des publicités produit et UGC sans organiser un tournage complet.", "Vérifiez la langue, la voix, les droits des médias, les crédits et les limites d’exportation."],
    cta: "Essayer InVideo AI",
    disclosure: "Information d’affiliation : MahGPT peut recevoir une commission si vous achetez via ce lien, sans coût supplémentaire pour vous."
  },
  "pt-BR": {
    heading: "InVideo AI v4.0: avatares, anúncios UGC e produção de vídeo mais rápida",
    intro: "O InVideo AI transforma um briefing escrito em um rascunho de vídeo com roteiro, cenas, narração, legendas e música. O fluxo v4.0 também introduziu AI Twins e AI Actors para vídeos com avatar e anúncios de produtos no estilo UGC.",
    points: ["Teste texto para vídeo e vídeos sem rosto para YouTube a partir de um briefing.", "Crie um AI Twin ou use um AI Actor como apresentador.", "Produza anúncios de produto e UGC sem organizar uma filmagem completa.", "Confira idioma, voz, direitos de mídia, créditos e limites de exportação."],
    cta: "Testar o InVideo AI",
    disclosure: "Aviso de afiliado: o MahGPT pode receber uma comissão se você comprar por este link, sem custo adicional."
  },
  ar: {
    heading: "InVideo AI v4.0: شخصيات رقمية وإعلانات UGC وإنتاج فيديو أسرع",
    intro: "يحوّل InVideo AI الملخص المكتوب إلى مسودة فيديو تشمل النص والمشاهد والتعليق الصوتي والترجمة والموسيقى. وقد قدّم إصدار v4.0 أيضًا AI Twins وAI Actors لفيديوهات الشخصيات الرقمية وإعلانات المنتجات بأسلوب UGC.",
    points: ["اختبر تحويل النص إلى فيديو وإنشاء فيديوهات يوتيوب بلا ظهور من ملخص واحد.", "أنشئ AI Twin أو استخدم AI Actor كمقدّم.", "أنشئ إعلانات منتجات وإعلانات UGC من دون تصوير كامل.", "راجع اللغة والصوت وحقوق الوسائط والرصيد وحدود التصدير."],
    cta: "جرّب InVideo AI",
    disclosure: "إفصاح الشراكة: قد تحصل MahGPT على عمولة عند الشراء عبر هذا الرابط من دون تكلفة إضافية عليك."
  },
  fa: {
    heading: "InVideo AI v4.0؛ آواتار، تبلیغات UGC و تولید سریع‌تر ویدئو",
    intro: "InVideo AI می‌تواند یک ایده یا توضیح متنی را به پیش‌نویس ویدئو همراه با سناریو، صحنه‌ها، گویندگی، زیرنویس و موسیقی تبدیل کند. جریان کاری v4.0 همچنین AI Twin و AI Actor را برای ویدئوهای آواتاری و تبلیغات محصول به سبک UGC معرفی کرد.",
    points: ["تبدیل متن به ویدئو و ساخت ویدئوهای بدون چهره برای یوتیوب را با یک بریف واقعی آزمایش کنید.", "یک AI Twin بسازید یا از AI Actor به‌عنوان مجری استفاده کنید.", "بدون هماهنگی یک فیلم‌برداری کامل، تبلیغات محصول و ویدئوهای UGC تولید کنید.", "پیش از انتشار، زبان، صدا، حقوق رسانه، اعتبار مصرفی و محدودیت خروجی را بررسی کنید."],
    cta: "آزمایش InVideo AI",
    disclosure: "افشای همکاری در فروش: اگر از طریق این لینک خرید کنید، ممکن است MahGPT بدون هزینهٔ اضافه برای شما کمیسیون دریافت کند."
  },
  tr: {
    heading: "InVideo AI v4.0: avatarlar, UGC reklamları ve daha hızlı video üretimi",
    intro: "InVideo AI, yazılı bir briefi senaryo, sahneler, seslendirme, altyazı ve müzik içeren bir video taslağına dönüştürür. v4.0 iş akışı ayrıca avatar videoları ve UGC tarzı ürün reklamları için AI Twins ve AI Actors özelliklerini tanıttı.",
    points: ["Tek bir briefle metinden videoya ve yüz göstermeden YouTube video iş akışlarını deneyin.", "Bir AI Twin oluşturun veya sunucu olarak AI Actor kullanın.", "Tam bir çekim organize etmeden ürün ve UGC reklamları üretin.", "Yayınlamadan önce dil, ses, medya hakları, krediler ve dışa aktarma sınırlarını kontrol edin."],
    cta: "InVideo AI'ı dene",
    disclosure: "Satış ortaklığı açıklaması: Bu bağlantı üzerinden satın alırsanız MahGPT size ek maliyet oluşturmadan komisyon kazanabilir."
  },
  it: {
    heading: "InVideo AI v4.0: avatar, annunci UGC e produzione video più rapida",
    intro: "InVideo AI trasforma un brief scritto in una bozza video con copione, scene, voce narrante, sottotitoli e musica. Il flusso v4.0 ha inoltre introdotto AI Twins e AI Actors per video con avatar e annunci prodotto in stile UGC.",
    points: ["Prova testo-in-video e video YouTube senza volto partendo da un solo brief.", "Crea un AI Twin o usa un AI Actor come presentatore.", "Produci annunci di prodotto e UGC senza organizzare una ripresa completa.", "Controlla lingua, voce, diritti dei media, crediti e limiti di esportazione."],
    cta: "Prova InVideo AI",
    disclosure: "Informativa di affiliazione: MahGPT può ricevere una commissione se acquisti tramite questo link, senza costi aggiuntivi."
  },
  ja: {
    heading: "InVideo AI v4.0：アバター、UGC広告、より速い動画制作",
    intro: "InVideo AIは、文章のブリーフから台本、シーン、ナレーション、字幕、音楽を含む動画の下書きを作成できます。v4.0では、アバター動画やUGC風の商品広告向けにAI TwinsとAI Actorsも導入されました。",
    points: ["1つのブリーフからテキスト動画化と顔出しなしYouTube動画を試せます。", "AI Twinを作成するか、AI Actorをプレゼンターとして利用できます。", "大規模な撮影を手配せずに商品広告やUGC広告を制作できます。", "公開前に言語、音声、素材の権利、クレジット、書き出し制限を確認してください。"],
    cta: "InVideo AIを試す",
    disclosure: "アフィリエイト開示：このリンクから購入すると、追加費用なしでMahGPTが報酬を受け取る場合があります。"
  },
  ko: {
    heading: "InVideo AI v4.0: 아바타, UGC 광고와 더 빠른 영상 제작",
    intro: "InVideo AI는 글로 작성한 브리프를 대본, 장면, 음성, 자막, 음악이 포함된 영상 초안으로 바꿉니다. v4.0 워크플로는 아바타 영상과 UGC 스타일 제품 광고를 위한 AI Twins와 AI Actors도 도입했습니다.",
    points: ["하나의 브리프로 텍스트 투 비디오와 얼굴 없는 YouTube 영상 제작을 테스트하세요.", "AI Twin을 만들거나 AI Actor를 진행자로 사용하세요.", "전체 촬영을 준비하지 않고 제품 및 UGC 광고를 제작하세요.", "게시 전에 언어, 음성, 미디어 권리, 크레딧과 내보내기 제한을 확인하세요."],
    cta: "InVideo AI 사용해 보기",
    disclosure: "제휴 공개: 이 링크로 구매하면 추가 비용 없이 MahGPT가 수수료를 받을 수 있습니다."
  },
  id: {
    heading: "InVideo AI v4.0: avatar, iklan UGC, dan produksi video yang lebih cepat",
    intro: "InVideo AI mengubah brief tertulis menjadi draf video dengan naskah, adegan, sulih suara, takarir, dan musik. Alur v4.0 juga memperkenalkan AI Twins dan AI Actors untuk video avatar serta iklan produk bergaya UGC.",
    points: ["Uji teks-ke-video dan video YouTube tanpa wajah dari satu brief.", "Buat AI Twin atau gunakan AI Actor sebagai presenter.", "Produksi iklan produk dan UGC tanpa mengatur pengambilan gambar lengkap.", "Periksa bahasa, suara, hak media, kredit, dan batas ekspor sebelum terbit."],
    cta: "Coba InVideo AI",
    disclosure: "Pengungkapan afiliasi: MahGPT dapat menerima komisi jika Anda membeli melalui tautan ini, tanpa biaya tambahan."
  },
  hi: {
    heading: "InVideo AI v4.0: अवतार, UGC विज्ञापन और तेज़ वीडियो निर्माण",
    intro: "InVideo AI लिखित ब्रीफ़ को स्क्रिप्ट, दृश्यों, वॉइसओवर, सबटाइटल और संगीत वाले वीडियो ड्राफ़्ट में बदल सकता है। v4.0 वर्कफ़्लो ने अवतार वीडियो और UGC शैली के उत्पाद विज्ञापनों के लिए AI Twins और AI Actors भी पेश किए।",
    points: ["एक ब्रीफ़ से टेक्स्ट-टू-वीडियो और बिना चेहरा दिखाए YouTube वीडियो आज़माएँ।", "AI Twin बनाएँ या AI Actor को प्रस्तुतकर्ता के रूप में उपयोग करें।", "पूरी शूटिंग आयोजित किए बिना उत्पाद और UGC विज्ञापन बनाएँ।", "प्रकाशित करने से पहले भाषा, आवाज़, मीडिया अधिकार, क्रेडिट और एक्सपोर्ट सीमा जाँचें।"],
    cta: "InVideo AI आज़माएँ",
    disclosure: "एफ़िलिएट खुलासा: इस लिंक से खरीदने पर MahGPT को बिना किसी अतिरिक्त लागत के कमीशन मिल सकता है।"
  }
};

function details(locale) {
  const c = copy[locale];
  return `<section class="affiliate-details" aria-labelledby="invideo-v4-${locale}"><h2 id="invideo-v4-${locale}">${c.heading}</h2><p>${c.intro}</p><ul>${c.points.map(point => `<li>${point}</li>`).join("")}</ul><p><a class="affiliate-cta" data-affiliate-slot="invideo-v4" href="${redirect}" target="_blank" rel="sponsored noopener">${c.cta} ↗</a></p><p class="affiliate-disclosure">${c.disclosure}</p><p class="official-source"><a href="https://help.invideo.io/en/articles/12048958-introducing-v4-0" target="_blank" rel="noopener noreferrer">Official InVideo v4.0 documentation ↗</a></p></section>`;
}

function linkBrandMentions(html) {
  const tokens = html.split(/(<[^>]+>)/g);
  const excluded = ["a", "h1", "h2", "h3", "title", "script", "style"];
  const stack = [];
  return tokens.map(token => {
    if (!token.startsWith("<")) {
      if (stack.some(tag => excluded.includes(tag))) return token;
      return token.replace(/\binvideo\b/gi, match => `<a class="affiliate-brand" href="${redirect}" target="_blank" rel="sponsored noopener">${match}</a>`);
    }
    const close = token.match(/^<\/\s*([a-z0-9-]+)/i);
    if (close) {
      const tag = close[1].toLowerCase();
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.splice(index, 1);
      return token;
    }
    const open = token.match(/^<\s*([a-z0-9-]+)/i);
    if (open && !/\/\s*>$/.test(token) && !/^(meta|link|img|br|hr|input)$/i.test(open[1])) stack.push(open[1].toLowerCase());
    return token;
  }).join("");
}

for (const locale of locales) {
  const file = locale === "en" ? "partners/invideo.html" : `${locale}/partners/invideo.html`;
  let html = await readFile(file, "utf8");

  html = html.replace(/data-affiliate-slot="([^"]*invideo[^"]*)" href="https:\/\/invideo\.io\/?"/gi, `data-affiliate-slot="$1" href="${redirect}"`);
  html = html.replace(/(data-affiliate-slot="[^"]*invideo[^"]*"[^>]*rel=")([^"]*)(")/gi, (_all, before, rel, after) => {
    const values = new Set(rel.split(/\s+/).filter(Boolean));
    values.add("sponsored"); values.add("noopener");
    return before + [...values].join(" ") + after;
  });

  if (locale !== "en") {
    html = html.replace(/<a class="btn" href="\/partners\/invideo\.html">([^<]+)<\/a>/, (_all, label) => `<a class="btn" data-affiliate-slot="invideo-localized" href="${redirect}" target="_blank" rel="sponsored noopener">${copy[locale].cta} ↗</a><a class="english-guide" href="/partners/invideo.html">${label}</a>`);
  }

  if (!html.includes('id="invideo-affiliate-styles"')) {
    html = html.replace("</head>", `<style id="invideo-affiliate-styles">.affiliate-brand{color:#3157c8!important;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}.affiliate-details{margin:36px 0;padding:28px;border:1px solid #ded8f3;border-radius:10px;background:#f8f6ff}.affiliate-details h2{margin-top:0}.affiliate-details li{margin:.55em 0}.affiliate-cta{display:inline-block;background:#6547e8;color:#fff!important;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:800}.affiliate-disclosure{font-size:.86em;color:#697187}.official-source{font-size:.86em}.english-guide{display:inline-block;margin-inline-start:14px;color:#5d35d5;font-weight:700}</style></head>`);
  }
  html = html.replace(/<section class="affiliate-details"[\s\S]*?<\/section>/, "");
  if (locale !== "en" && html.includes('<article class="wrap main">')) {
    html = html.replace("</article>", `${details(locale)}</article>`);
  } else {
    html = html.replace("</main>", `${details(locale)}</main>`);
  }
  html = linkBrandMentions(html);

  await writeFile(file, html);
}

console.log("Activated protected InVideo affiliate links and localized v4.0 content for 13 locale pages.");
