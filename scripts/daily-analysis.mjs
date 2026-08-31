import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = "https://mahgpt.com";
const feedPath = path.join(root, "assets/news-feed.json");
const localesPath = path.join(root, "config/locales.json");
const manifestPath = path.join(root, "assets/daily-analysis.json");
const today = process.env.DAILY_ANALYSIS_DATE || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
};
const esc = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const text = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&amp;|&quot;|&#39;|&apos;|&lt;|&gt;/gi, match => ({ "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">" }[match.toLowerCase()] || match)).replace(/\s+/g, " ").trim();
const cleanHeadline = value => text(value).replace(/\s+(?:\||-|–|—)\s+(?:the ai economy|ken yeung|techcrunch|venturebeat|wired|the verge|techradar|macworld|creative bloq|gadgets 360|engadget|artificial intelligence news)\s*$/i, "").replace(/[|–—-]\s*$/, "").trim();
const slug = value => cleanHeadline(value).toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "ai-news";
const sourceName = item => {
  const explicit = text(item.source_name || item.sourceName || item.publisher || item.creator || item.siteName);
  if (explicit && !/^news$/i.test(explicit)) return explicit;
  try { return new URL(item.source || "").hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  catch { return "AI news source"; }
};
const storyUrl = item => "/news/story.html?id=" + encodeURIComponent(slug(item.title || item.headline));
const items = (readJson(feedPath, { items: [] }).items || []).filter(item => item && item.title && item.source).slice(0, 8).map(item => ({
  title: cleanHeadline(item.title || item.headline),
  summary: text(item.summary || item.description || "").slice(0, 260),
  source: item.source,
  sourceName: sourceName(item),
  story: storyUrl(item),
  category: item.category || item.toolName || "AI news"
}));

if (items.length < 3) {
  throw new Error("Daily analysis needs at least 3 news items to avoid thin commentary.");
}

const themes = [
  { key: "video", label: "video AI", test: /video|runway|pictory|invideo|heygen|sora|clip|motion|youtube/i, tool: "Pictory", url: "/go/pictory.html" },
  { key: "audio", label: "audio and voice AI", test: /audio|voice|music|soundraw|elevenlabs|podcast|song|tts/i, tool: "SOUNDRAW", url: "/go/soundraw.html" },
  { key: "image", label: "image and design AI", test: /image|photo|design|canva|adobe|creative|firefly|visual/i, tool: "Adobe", url: "/partners/adobe.html" },
  { key: "search", label: "AI search", test: /search|google|bing|copilot|chatgpt|answer|overview|perplexity/i, tool: "SEMrush", url: "/partners/semrush.html" },
  { key: "productivity", label: "workflow automation", test: /agent|automation|workflow|productivity|office|workspace|coding|developer/i, tool: "Descript", url: "/go/descript.html" },
  { key: "business", label: "AI business", test: /startup|funding|enterprise|business|market|ads|commerce|revenue/i, tool: "Hostinger", url: "/partners/hostinger.html" }
];
const scoreThemes = stories => themes.map(theme => ({ ...theme, count: stories.filter(item => theme.test.test([item.title, item.summary, item.category].join(" "))).length })).filter(theme => theme.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
const pickedThemes = scoreThemes(items);
if (!pickedThemes.length) pickedThemes.push(themes[5], themes[4]);
const primaryTheme = pickedThemes[0];
const secondaryTheme = pickedThemes[1] || pickedThemes[0];
const title = `Daily AI Analysis: ${primaryTheme.label}, ${secondaryTheme.label}, and what changes next`;
const description = `MahGPT's daily analysis of ${items.length} AI stories, focusing on what changed, why it matters, and which practical workflows to watch.`;

const labels = {
  en: {
    titlePrefix: "Daily AI Analysis", home: "MahGPT", news: "AI News", analysis: "Daily AI Analysis",
    intro: count => `Today’s AI cycle is not just a list of announcements. Across ${count} relevant stories, the stronger signal is how AI tools are moving from isolated demos into everyday production workflows.`,
    matters: "Why it matters", take: "MahGPT take", watch: "What to watch next", sources: "Stories behind today’s analysis", tools: "Practical MahGPT tool routes",
    mattersText: (a, b) => `The important shift is the overlap between ${a.label} and ${b.label}. When these categories move together, users do not only ask what is new; they ask which tool is reliable enough to add to a real workflow.`,
    takeText: tool => `MahGPT’s view: treat the news as a workflow signal, not as hype. If a product update helps people create, edit, publish, search, or sell faster, it deserves a practical test. If it only repeats a promise without a usable path, it should stay in the watchlist.`,
    watchText: a => `Watch whether ${a.label} updates produce repeatable results, clearer pricing, stronger export options, and fewer manual steps. Those details are what turn AI news into business value.`,
    cta: tool => `Explore the related ${tool} route`
  },
  fa: {
    titlePrefix: "تحلیل روزانه هوش مصنوعی", home: "MahGPT", news: "اخبار هوش مصنوعی", analysis: "تحلیل روزانه",
    intro: count => `چرخهٔ امروز هوش مصنوعی فقط فهرست خبرها نیست. در میان ${count} خبر مرتبط، نشانهٔ مهم‌تر این است که ابزارهای هوش مصنوعی از نمایش‌های جداگانه به سمت workflowهای واقعی روزمره حرکت می‌کنند.`,
    matters: "چرا مهم است", take: "برداشت MahGPT", watch: "چه چیزی را بعداً دنبال کنیم", sources: "خبرهای پشت این تحلیل", tools: "مسیرهای کاربردی MahGPT",
    mattersText: (a, b) => `تغییر مهم، هم‌پوشانی میان ${a.label} و ${b.label} است. وقتی این دسته‌ها هم‌زمان حرکت می‌کنند، سؤال اصلی فقط «چه خبر تازه‌ای آمده؟» نیست؛ سؤال این است که کدام ابزار واقعاً به workflow قابل اعتماد تبدیل می‌شود.`,
    takeText: () => `نگاه MahGPT این است: خبر را به‌عنوان سیگنال workflow ببین، نه هیجان کوتاه‌مدت. اگر یک به‌روزرسانی به ساخت، ویرایش، انتشار، جست‌وجو یا فروش سریع‌تر کمک کند، ارزش تست عملی دارد. اگر فقط وعده باشد، باید در watchlist بماند.`,
    watchText: a => `باید دید به‌روزرسانی‌های ${a.label} چقدر خروجی تکرارپذیر، قیمت‌گذاری روشن، export بهتر و مراحل دستی کمتر ایجاد می‌کنند. همین جزئیات خبر را به ارزش تجاری تبدیل می‌کند.`,
    cta: tool => `مسیر مرتبط ${tool} را ببین`
  },
  ar: {
    titlePrefix: "تحليل الذكاء الاصطناعي اليومي", home: "MahGPT", news: "أخبار الذكاء الاصطناعي", analysis: "التحليل اليومي",
    intro: count => `دورة أخبار الذكاء الاصطناعي اليوم ليست مجرد عناوين. من بين ${count} أخبار، الإشارة الأهم هي انتقال الأدوات من العروض المنفصلة إلى سير عمل يومي حقيقي.`,
    matters: "لماذا يهم", take: "رأي MahGPT", watch: "ما الذي نراقبه لاحقاً", sources: "الأخبار وراء هذا التحليل", tools: "مسارات MahGPT العملية",
    mattersText: (a, b) => `التحول المهم هو التداخل بين ${a.label} و ${b.label}. عندما تتحرك هذه الفئات معاً، يصبح السؤال: أي أداة تستحق الدخول في سير عمل حقيقي؟`,
    takeText: () => `رأي MahGPT: تعامل مع الخبر كإشارة لسير العمل، لا كضجة مؤقتة. التحديث الذي يساعد على الإنشاء أو التحرير أو النشر أو البحث أو البيع يستحق اختباراً عملياً.`,
    watchText: a => `راقب ما إذا كانت تحديثات ${a.label} تقدم نتائج قابلة للتكرار، سعراً أوضح، خيارات تصدير أفضل، وخطوات يدوية أقل.`,
    cta: tool => `استكشف مسار ${tool} المرتبط`
  }
};
const fallbackLabels = code => ({
  titlePrefix: "Daily AI Analysis", home: "MahGPT", news: "AI News", analysis: "Daily AI Analysis",
  intro: count => `This localized MahGPT briefing analyzes ${count} AI stories and explains what changed, why it matters, and which practical workflows deserve attention.`,
  matters: "Why it matters", take: "MahGPT take", watch: "What to watch next", sources: "Stories behind today’s analysis", tools: "Practical MahGPT tool routes",
  mattersText: (a, b) => `The strongest signal is the connection between ${a.label} and ${b.label}. That connection matters because useful AI adoption depends on reliable workflows, not isolated announcements.`,
  takeText: () => `MahGPT reads these stories as practical workflow signals. The priority is not the loudest headline, but the update most likely to help creators, teams, and small businesses finish work faster.`,
  watchText: a => `Watch whether ${a.label} becomes easier to test, cheaper to deploy, and clearer to integrate with publishing or business workflows.`,
  cta: tool => `Explore the related ${tool} route`
});
const localeLabels = code => labels[code] || fallbackLabels(code);
const alternates = (locales, date) => locales.map(locale => {
  const href = locale.code === "en" ? `${base}/news/analysis/${date}.html` : `${base}/${locale.code}/news/analysis/${date}.html`;
  return `<link rel="alternate" hreflang="${locale.hreflang}" href="${href}">`;
}).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${base}/news/analysis/${date}.html">`;

Object.assign(labels, {
  es: {
    titlePrefix: "Análisis diario de IA", home: "MahGPT", news: "Noticias de IA", analysis: "Análisis diario",
    intro: count => `El ciclo de IA de hoy no es solo una lista de anuncios. En ${count} historias relevantes, la señal más fuerte es que las herramientas de IA pasan de demos aisladas a flujos de trabajo reales.`,
    matters: "Por qué importa", take: "Lectura de MahGPT", watch: "Qué observar después", sources: "Historias detrás del análisis", tools: "Rutas prácticas de MahGPT",
    mattersText: (a, b) => `El cambio importante es la conexión entre ${a.label} y ${b.label}. Cuando estas categorías avanzan juntas, la pregunta clave es qué herramienta merece entrar en un flujo de trabajo real.`,
    takeText: () => `MahGPT lee estas noticias como señales de workflow, no como ruido. Si una actualización ayuda a crear, editar, publicar, buscar o vender más rápido, merece una prueba práctica.`,
    watchText: a => `Observa si ${a.label} ofrece resultados repetibles, precios más claros, mejores exportaciones y menos pasos manuales.`,
    cta: tool => `Explorar la ruta relacionada de ${tool}`
  },
  de: {
    titlePrefix: "Tägliche KI-Analyse", home: "MahGPT", news: "KI-News", analysis: "Tägliche Analyse",
    intro: count => `Der heutige KI-Zyklus ist mehr als eine Liste von Meldungen. In ${count} relevanten Geschichten zeigt sich, dass KI-Tools von Demos in echte Arbeitsabläufe rücken.`,
    matters: "Warum das wichtig ist", take: "MahGPT-Einschätzung", watch: "Worauf wir achten", sources: "Quellen dieser Analyse", tools: "Praktische MahGPT-Routen",
    mattersText: (a, b) => `Wichtig ist die Verbindung zwischen ${a.label} und ${b.label}. Wenn diese Bereiche gemeinsam wachsen, zählt vor allem, welches Tool in einem echten Workflow verlässlich ist.`,
    takeText: () => `MahGPT betrachtet Nachrichten als Workflow-Signale, nicht als Hype. Updates mit Nutzen für Erstellung, Bearbeitung, Veröffentlichung, Suche oder Vertrieb verdienen einen Praxistest.`,
    watchText: a => `Achte darauf, ob ${a.label} wiederholbare Ergebnisse, klarere Preise, bessere Exporte und weniger manuelle Schritte liefert.`,
    cta: tool => `Die passende ${tool}-Route ansehen`
  },
  fr: {
    titlePrefix: "Analyse IA quotidienne", home: "MahGPT", news: "Actualités IA", analysis: "Analyse quotidienne",
    intro: count => `Le cycle IA du jour n’est pas seulement une suite d’annonces. À travers ${count} sujets, le signal fort est le passage des outils IA vers des workflows quotidiens concrets.`,
    matters: "Pourquoi c’est important", take: "Lecture MahGPT", watch: "À suivre", sources: "Sources de l’analyse", tools: "Parcours pratiques MahGPT",
    mattersText: (a, b) => `Le point important est le lien entre ${a.label} et ${b.label}. Quand ces catégories avancent ensemble, la vraie question devient: quel outil tient dans un workflow réel?`,
    takeText: () => `MahGPT lit ces nouvelles comme des signaux de workflow, pas comme du bruit. Une mise à jour utile pour créer, éditer, publier, chercher ou vendre mérite un test pratique.`,
    watchText: a => `Surveille si ${a.label} apporte des résultats répétables, des prix plus clairs, de meilleurs exports et moins d’étapes manuelles.`,
    cta: tool => `Voir le parcours ${tool} lié`
  },
  "pt-BR": {
    titlePrefix: "Análise diária de IA", home: "MahGPT", news: "Notícias de IA", analysis: "Análise diária",
    intro: count => `O ciclo de IA de hoje não é só uma lista de anúncios. Em ${count} histórias relevantes, o sinal principal é a ida das ferramentas de IA para fluxos de trabalho reais.`,
    matters: "Por que importa", take: "Leitura da MahGPT", watch: "O que acompanhar", sources: "Histórias por trás da análise", tools: "Rotas práticas da MahGPT",
    mattersText: (a, b) => `A mudança importante é a conexão entre ${a.label} e ${b.label}. Quando essas áreas avançam juntas, o essencial é saber qual ferramenta cabe em um workflow real.`,
    takeText: () => `A MahGPT lê essas notícias como sinais de workflow, não como hype. Se uma atualização ajuda a criar, editar, publicar, pesquisar ou vender mais rápido, vale um teste prático.`,
    watchText: a => `Observe se ${a.label} entrega resultados repetíveis, preços claros, melhores exportações e menos etapas manuais.`,
    cta: tool => `Explorar a rota relacionada de ${tool}`
  },
  tr: {
    titlePrefix: "Günlük yapay zekâ analizi", home: "MahGPT", news: "Yapay zekâ haberleri", analysis: "Günlük analiz",
    intro: count => `Bugünün yapay zekâ döngüsü sadece duyurulardan ibaret değil. ${count} ilgili haberde ana işaret, araçların demo olmaktan çıkıp gerçek iş akışlarına girmesi.`,
    matters: "Neden önemli", take: "MahGPT yorumu", watch: "Sonra ne izlenmeli", sources: "Analizin dayandığı haberler", tools: "Pratik MahGPT rotaları",
    mattersText: (a, b) => `Önemli değişim ${a.label} ile ${b.label} arasındaki bağlantı. Bu alanlar birlikte ilerlediğinde asıl soru, hangi aracın gerçek bir iş akışına güvenle gireceği olur.`,
    takeText: () => `MahGPT bu haberleri hype değil workflow sinyali olarak okur. Oluşturma, düzenleme, yayınlama, arama veya satış hızını artıran güncellemeler pratik test hak eder.`,
    watchText: a => `${a.label} alanında tekrarlanabilir sonuçlar, daha net fiyatlar, daha güçlü export ve daha az manuel adım görüp görmediğimizi izle.`,
    cta: tool => `İlgili ${tool} rotasını incele`
  },
  it: {
    titlePrefix: "Analisi IA quotidiana", home: "MahGPT", news: "Notizie IA", analysis: "Analisi quotidiana",
    intro: count => `Il ciclo IA di oggi non è solo una lista di annunci. In ${count} notizie rilevanti, il segnale forte è il passaggio degli strumenti IA verso workflow reali.`,
    matters: "Perché conta", take: "Lettura di MahGPT", watch: "Cosa osservare", sources: "Notizie dietro l’analisi", tools: "Percorsi pratici MahGPT",
    mattersText: (a, b) => `Il cambiamento importante è il legame tra ${a.label} e ${b.label}. Quando queste categorie si muovono insieme, conta capire quale strumento regge in un workflow reale.`,
    takeText: () => `MahGPT legge queste notizie come segnali di workflow, non come hype. Un aggiornamento che aiuta a creare, modificare, pubblicare, cercare o vendere merita un test pratico.`,
    watchText: a => `Osserva se ${a.label} produce risultati ripetibili, prezzi più chiari, export migliori e meno passaggi manuali.`,
    cta: tool => `Esplora il percorso ${tool} collegato`
  },
  ja: {
    titlePrefix: "毎日のAI分析", home: "MahGPT", news: "AIニュース", analysis: "デイリー分析",
    intro: count => `今日のAIニュースは発表の一覧ではありません。${count}件の関連ニュースから見える重要な流れは、AIツールがデモから日常のワークフローへ移っていることです。`,
    matters: "なぜ重要か", take: "MahGPTの見方", watch: "次に見るべき点", sources: "分析の元になったニュース", tools: "MahGPTの実用ルート",
    mattersText: (a, b) => `重要なのは ${a.label} と ${b.label} のつながりです。複数の領域が同時に動くと、実際の作業に入れられるほど信頼できるツールかが問われます。`,
    takeText: () => `MahGPTはニュースを短期的な話題ではなく、ワークフローのシグナルとして読みます。作成、編集、公開、検索、販売を速くする更新は実用テストに値します。`,
    watchText: a => `${a.label} が再現性のある結果、明確な価格、強い書き出し機能、少ない手作業を提供するかを見ます。`,
    cta: tool => `関連する ${tool} ルートを見る`
  },
  ko: {
    titlePrefix: "일일 AI 분석", home: "MahGPT", news: "AI 뉴스", analysis: "일일 분석",
    intro: count => `오늘의 AI 흐름은 단순한 발표 목록이 아닙니다. ${count}개의 관련 소식에서 보이는 핵심은 AI 도구가 데모를 넘어 실제 업무 흐름으로 들어오고 있다는 점입니다.`,
    matters: "왜 중요한가", take: "MahGPT 관점", watch: "다음에 볼 것", sources: "분석에 사용한 소식", tools: "실용적인 MahGPT 경로",
    mattersText: (a, b) => `중요한 변화는 ${a.label}와 ${b.label}의 연결입니다. 이런 영역이 함께 움직일 때 실제 workflow에 넣을 만큼 신뢰할 수 있는 도구인지가 핵심이 됩니다.`,
    takeText: () => `MahGPT는 뉴스를 hype가 아니라 workflow 신호로 봅니다. 제작, 편집, 발행, 검색, 판매를 빠르게 만드는 업데이트는 실제 테스트할 가치가 있습니다.`,
    watchText: a => `${a.label}가 반복 가능한 결과, 명확한 가격, 더 나은 내보내기, 적은 수작업을 제공하는지 지켜봅니다.`,
    cta: tool => `관련 ${tool} 경로 보기`
  },
  id: {
    titlePrefix: "Analisis AI harian", home: "MahGPT", news: "Berita AI", analysis: "Analisis harian",
    intro: count => `Siklus AI hari ini bukan sekadar daftar pengumuman. Dari ${count} cerita relevan, sinyal terkuat adalah perpindahan alat AI menuju workflow nyata sehari-hari.`,
    matters: "Mengapa penting", take: "Pandangan MahGPT", watch: "Yang perlu dipantau", sources: "Berita di balik analisis", tools: "Rute praktis MahGPT",
    mattersText: (a, b) => `Perubahan penting ada pada hubungan antara ${a.label} dan ${b.label}. Saat kategori ini bergerak bersama, pertanyaan utamanya adalah alat mana yang layak masuk workflow nyata.`,
    takeText: () => `MahGPT membaca berita ini sebagai sinyal workflow, bukan hype. Pembaruan yang membantu membuat, mengedit, menerbitkan, mencari, atau menjual lebih cepat layak diuji.`,
    watchText: a => `Pantau apakah ${a.label} memberi hasil yang berulang, harga lebih jelas, ekspor lebih kuat, dan langkah manual lebih sedikit.`,
    cta: tool => `Jelajahi rute ${tool} terkait`
  },
  hi: {
    titlePrefix: "दैनिक AI विश्लेषण", home: "MahGPT", news: "AI समाचार", analysis: "दैनिक विश्लेषण",
    intro: count => `आज का AI चक्र केवल घोषणाओं की सूची नहीं है। ${count} संबंधित खबरों में बड़ा संकेत यह है कि AI टूल डेमो से निकलकर वास्तविक workflow में जा रहे हैं।`,
    matters: "यह क्यों महत्वपूर्ण है", take: "MahGPT की राय", watch: "आगे क्या देखें", sources: "इस विश्लेषण की खबरें", tools: "व्यावहारिक MahGPT मार्ग",
    mattersText: (a, b) => `महत्वपूर्ण बदलाव ${a.label} और ${b.label} के संबंध में है। जब ये श्रेणियाँ साथ बढ़ती हैं, असली प्रश्न होता है कि कौन सा टूल वास्तविक workflow में भरोसेमंद है।`,
    takeText: () => `MahGPT इन खबरों को hype नहीं बल्कि workflow संकेत मानता है। जो अपडेट निर्माण, संपादन, प्रकाशन, खोज या बिक्री को तेज करे, उसका व्यावहारिक परीक्षण होना चाहिए।`,
    watchText: a => `देखें कि ${a.label} दोहराने योग्य परिणाम, स्पष्ट कीमत, बेहतर export और कम manual steps देता है या नहीं।`,
    cta: tool => `${tool} से जुड़ा मार्ग देखें`
  }
});

const schema = (locale, l, pageUrl) => JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: l.home, item: base + (locale.code === "en" ? "/" : `/${locale.code}/`) },
      { "@type": "ListItem", position: 2, name: l.news, item: base + (locale.code === "en" ? "/news/" : `/${locale.code}/news/`) },
      { "@type": "ListItem", position: 3, name: l.analysis, item: pageUrl }
    ] },
    { "@type": "NewsArticle", headline: `${l.titlePrefix}: ${primaryTheme.label} and ${secondaryTheme.label}`, description, articleSection: "AI analysis", datePublished: today, dateModified: today, author: { "@type": "Organization", name: "MahGPT" }, publisher: { "@type": "Organization", name: "MahGPT" }, mainEntityOfPage: pageUrl }
  ]
});

function page(locale) {
  const l = localeLabels(locale.code), rtl = locale.dir === "rtl";
  const pathPrefix = locale.code === "en" ? "" : `/${locale.code}`;
  const homeHref = locale.code === "en" ? "/" : `/${locale.code}/`;
  const pageUrl = `${base}${pathPrefix}/news/analysis/${today}.html`;
  const related = pickedThemes.map(theme => `<li><a href="${theme.url}">${esc(l.cta(theme.tool))}</a></li>`).join("\n");
  const sourceList = items.slice(0, 6).map(item => `<li><a href="${item.story}">${esc(item.title)}</a> <span>— ${esc(item.sourceName)}</span></li>`).join("\n");
  const storyLinks = items.slice(0, 4).map(item => `<a href="${item.story}">${esc(item.title)}</a>`).join(" ");
  return `<!doctype html>
<html lang="${locale.hreflang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(l.titlePrefix)} — ${today} | MahGPT</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${pageUrl}">
${alternates(readJson(localesPath, { supported: [locale] }).supported, today)}
<meta property="og:type" content="article"><meta property="og:title" content="${esc(l.titlePrefix)} — ${today}"><meta property="og:description" content="${esc(description)}">
<meta property="article:published_time" content="${today}"><meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="/assets/mahgpt-favicon.svg">
<script type="application/ld+json">${schema(locale, l, pageUrl)}</script>
<style>:root{--paper:#f7f4ee;--ink:#111a2c;--muted:#63718a;--red:#c54137;--line:#d8d2c8;--panel:#fffdf8}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,Arial,sans-serif;line-height:1.75}a{color:var(--red);font-weight:800}.wrap{max-width:980px;margin:auto;padding:34px 24px 80px}.brand{font:700 34px Georgia,serif;text-decoration:none;color:var(--ink)}.brand span{color:var(--red)}nav{margin:22px 0;color:var(--muted);font-size:14px}h1{font:700 clamp(38px,7vw,76px)/1.02 Georgia,serif;letter-spacing:-2px;margin:28px 0 14px}.dek{font-size:20px;color:var(--muted);max-width:780px}.meta{color:var(--muted);font-size:14px;margin:18px 0 40px}.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:50px}.card{background:var(--panel);border:1px solid var(--line);padding:24px;margin:0 0 26px}.brief p{margin:0 0 22px}.brief h2{font:700 30px Georgia,serif;margin:0 0 12px}.brief h3{font:700 22px Georgia,serif;margin:0 0 10px}.sources li,.tools li{margin:0 0 12px}.sources span{color:var(--muted);font-size:13px}.note{font-size:14px;color:var(--muted)}@media(max-width:820px){.grid{grid-template-columns:1fr}h1{letter-spacing:-1px}}</style>
</head>
<body><main class="wrap"><a class="brand" href="${homeHref}">Mah<span>GPT</span></a>
<nav aria-label="Breadcrumb"><a href="${homeHref}">${esc(l.home)}</a> / <a href="${pathPrefix}/news/">${esc(l.news)}</a> / <span>${esc(l.analysis)}</span></nav>
<article>
<p class="meta"><time datetime="${today}">${today}</time> · MahGPT analysis desk</p>
<h1>${esc(l.titlePrefix)}: ${esc(primaryTheme.label)} and ${esc(secondaryTheme.label)}</h1>
<p class="dek">${esc(l.intro(items.length))}</p>
<div class="grid"><section class="brief">
<div class="card"><h2>${esc(l.matters)}</h2><p>${esc(l.mattersText(primaryTheme, secondaryTheme))}</p><p>${storyLinks}</p></div>
<div class="card"><h2>${esc(l.take)}</h2><p>${esc(l.takeText(primaryTheme.tool))}</p><p>The practical reading is that creators and small teams should compare tools by output quality, publishing speed, export reliability, and whether the update reduces the number of manual handoffs.</p></div>
<div class="card"><h2>${esc(l.watch)}</h2><p>${esc(l.watchText(primaryTheme))}</p><p>This page is generated from today’s verified feed and adds MahGPT’s workflow-focused interpretation so the site is not only repeating source headlines.</p></div>
</section><aside>
<div class="card sources"><h3>${esc(l.sources)}</h3><ol>${sourceList}</ol></div>
<div class="card tools"><h3>${esc(l.tools)}</h3><ul>${related}</ul></div>
<p class="note">Affiliate links are used only where a tool is relevant to the analysis.</p>
</aside></div>
</article></main></body></html>`;
}

function analysisIndexPage(locale, generatedPath) {
  const l = localeLabels(locale.code), rtl = locale.dir === "rtl", pathPrefix = locale.code === "en" ? "" : `/${locale.code}`;
  const homeHref = locale.code === "en" ? "/" : `/${locale.code}/`;
  const pageUrl = `${base}${pathPrefix}/news/analysis/index.html`;
  return `<!doctype html><html lang="${locale.hreflang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.analysis)} | ${esc(locale.name)} | MahGPT</title><meta name="description" content="Daily MahGPT analysis of AI news, tools, workflows and market signals."><link rel="canonical" href="${pageUrl}"><meta property="og:title" content="${esc(l.analysis)} | MahGPT"><meta property="og:description" content="Daily MahGPT analysis of AI news, tools, workflows and market signals."><meta name="twitter:card" content="summary"><link rel="icon" type="image/svg+xml" href="/assets/mahgpt-favicon.svg"><style>body{font-family:Inter,Arial,sans-serif;max-width:860px;margin:auto;padding:34px 24px;line-height:1.7;background:#f7f4ee;color:#111a2c}a{color:#c54137;font-weight:800}.brand{font:700 34px Georgia,serif;text-decoration:none;color:#111a2c}.brand span{color:#c54137}h1{font:700 54px Georgia,serif}</style></head><body><a class="brand" href="${homeHref}">Mah<span>GPT</span></a><h1>${esc(l.analysis)}</h1><p>${esc(l.intro(items.length))}</p><p><a href="${path.basename(generatedPath)}">${esc(l.titlePrefix)} — ${today}</a></p></body></html>`;
}

function localeNewsIndexPage(locale) {
  const l = localeLabels(locale.code), rtl = locale.dir === "rtl", pathPrefix = locale.code === "en" ? "" : `/${locale.code}`;
  const homeHref = locale.code === "en" ? "/" : `/${locale.code}/`;
  const pageUrl = `${base}${pathPrefix}/news/index.html`;
  return `<!doctype html><html lang="${locale.hreflang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.news)} | ${esc(locale.name)} | MahGPT</title><meta name="description" content="MahGPT AI news and daily workflow analysis."><link rel="canonical" href="${pageUrl}"><meta property="og:title" content="${esc(l.news)} | MahGPT"><meta property="og:description" content="MahGPT AI news and daily workflow analysis."><meta name="twitter:card" content="summary"><link rel="icon" type="image/svg+xml" href="/assets/mahgpt-favicon.svg"><style>body{font-family:Inter,Arial,sans-serif;max-width:860px;margin:auto;padding:34px 24px;line-height:1.7;background:#f7f4ee;color:#111a2c}a{color:#c54137;font-weight:800}.brand{font:700 34px Georgia,serif;text-decoration:none;color:#111a2c}.brand span{color:#c54137}h1{font:700 54px Georgia,serif}</style></head><body><a class="brand" href="${homeHref}">Mah<span>GPT</span></a><h1>${esc(l.news)}</h1><p>${esc(l.intro(items.length))}</p><p><a href="${pathPrefix}/news/analysis/">${esc(l.analysis)}</a></p></body></html>`;
}

const config = readJson(localesPath, { supported: [{ code: "en", hreflang: "en", dir: "ltr", name: "English" }] });
const manifest = { version: 1, generated_at: new Date().toISOString(), analysis_date: today, stories: items.map(item => ({ title: item.title, source: item.source, mahgpt_url: storyUrl(item) })), locales: [] };
for (const locale of config.supported) {
  const dir = locale.code === "en" ? path.join(root, "news", "analysis") : path.join(root, locale.code, "news", "analysis");
  fs.mkdirSync(dir, { recursive: true });
  const articlePath = path.join(dir, `${today}.html`);
  fs.writeFileSync(articlePath, page(locale) + "\n");
  fs.writeFileSync(path.join(dir, "index.html"), analysisIndexPage(locale, articlePath) + "\n");
  if (locale.code !== "en") {
    const newsDir = path.join(root, locale.code, "news");
    fs.mkdirSync(newsDir, { recursive: true });
    fs.writeFileSync(path.join(newsDir, "index.html"), localeNewsIndexPage(locale) + "\n");
  }
  manifest.locales.push({ code: locale.code, path: path.relative(root, articlePath).replaceAll(path.sep, "/") });
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Generated daily AI analysis for ${config.supported.length} locales on ${today}.`);