const entities = { "&nbsp;":" ", "&amp;":"&", "&quot;":"\"", "&#39;":"'", "&apos;":"'", "&lt;":"<", "&gt;":">" };
export const cleanText = value => String(value ?? "")
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&(?:nbsp|amp|quot|#39|apos|lt|gt);/gi, match => entities[match.toLowerCase()] ?? match)
  .replace(/\s+/g, " ").trim();

const publisherTail = /\s+(?:\||-|–|—)\s+(?:the ai economy|ken yeung|techcrunch|venturebeat|wired|the verge|techradar|macworld|creative bloq|gadgets 360|engadget|artificial intelligence news)\s*$/i;
export const cleanHeadline = value => cleanText(value).replace(publisherTail, "").replace(/[|–—-]\s*$/, "").trim();

export const sourceName = value => {
  try { const host = new URL(value).hostname.replace(/^www\./, ""); return host.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  catch { return ""; }
};

export const storySlug = (value, fallback = "ai-news") => {
  const slug = cleanHeadline(value).toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  return slug || fallback;
};

const comparable = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
export const editorialSummary = (item = {}) => {
  const headline = cleanHeadline(item.headline || item.title);
  const raw = cleanText(item.summary || item.description);
  if (!raw || comparable(raw) === comparable(headline)) {
    const partner = item.toolName || item.detectedPartner || "";
    return partner ? partner + " is the focus of this latest update. MahGPT is tracking what changed and what it could mean for people evaluating the tool."
      : "This is a new development in the AI and technology ecosystem. MahGPT is tracking the confirmed details and their practical implications.";
  }
  const useful = raw.toLowerCase().startsWith(headline.toLowerCase()) ? raw.slice(headline.length).replace(/^[\s:–—-]+/, "") : raw;
  return cleanText(useful || raw).slice(0, 520).replace(/\s+\S*$/, "") + (useful.length > 520 ? "…" : "");
};

const partnerAliases = [
  ["horizons", /\bhostinger\s+horizons\b|\bhorizons\b/],
  ["elevenlabs", /\beleven\s*labs\b/],
  ["adobe", /\badobe\b|\bfirefly\b/],
  ["descript", /\bdescript\b/],
  ["invideo", /\binvideo\b/],
  ["canva", /\bcanva\b/],
  ["hostinger", /\bhostinger\b/],
  ["semrush", /\bsemrush\b/],
  ["surfer", /\bsurfer(?:\s*seo)?\b/],
  ["heygen", /\bheygen\b/],
  ["fliki", /\bfliki\b/],
  ["pictory", /\bpictory\b/],
  ["soundraw", /\bsoundraw\b/],
  ["adcreative", /\badcreative(?:\.ai)?\b/],
  ["create-music-ai", /\bcreate\s*music\s*ai\b|\bcreatemusicai\b/],
  ["jasper", /\bjasper\b/],
  ["runway", /\brunway\b/]
];

export const detectPartner = (item = {}) => {
  const haystack = cleanText([item.headline, item.title, item.summary, item.source, item.articleTitle, item.articleDescription].join(" ")).toLowerCase();
  return partnerAliases.find(([, pattern]) => pattern.test(haystack))?.[0] || null;
};
