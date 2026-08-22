import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const FEED = "assets/news-feed.json";
const LINKS = "config/social-affiliate-links.json";
const STATE = "data/telegram-published.json";
const CHANNEL = process.env.TELEGRAM_CHANNEL || "@mahgptplus";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const mode = process.argv[2] || "automatic";

const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; } };
const keyFor = n => n.source || [n.title, n.publishedAt].join("|");
const articleUrl = n => "https://mahgpt.com/news/index.html?story=" + encodeURIComponent(n.source || "");
const escapeHtml = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const resolveProduct = (n, links) => {
  const entry = links[n.tool] || {};
  if (entry.status === "active" && entry.affiliateUrl) return { url: entry.affiliateUrl, disclosure: "Affiliate link" };
  return { url: entry.officialUrl || "", disclosure: "" };
};
const messageFor = (n, product) => {
  const summary = String(n.summary || "MahGPT is tracking this development and its practical implications.");
  const paragraphs = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  const body = [paragraphs.slice(0, 2).join(" "), paragraphs.slice(2).join(" ")].filter(Boolean).join("\n\n");
  const cta = product.url ? "\n\n🚀 <b>Explore " + escapeHtml(n.toolName || "the product") + ":</b> " + escapeHtml(product.url) : "";
  const disclosure = product.disclosure ? "\n\n<i>Affiliate disclosure: MahGPT may earn a commission if you use this link.</i>" : "";
  return "<b>" + escapeHtml(n.title) + "</b>\n\n" + escapeHtml(body) +
    "\n\n🔗 <b>Read the full story:</b> " + escapeHtml(articleUrl(n)) + cta + disclosure;
};
const api = async (method, fields) => {
  const response = await fetch("https://api.telegram.org/bot" + TOKEN + "/" + method, { method:"POST", body: fields });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || "Telegram API request failed");
  return data;
};
const send = async (n, links) => {
  const product = resolveProduct(n, links);
  const text = messageFor(n, product);
  if (n.image) {
    const file = "telegram-image-" + Date.now() + ".tmp";
    try {
      const imageResponse = await fetch(n.image, { headers: { "user-agent": "MahGPT-TelegramPublisher/1.0" } });
      if (imageResponse.ok) {
        await pipeline(imageResponse.body, createWriteStream(file));
        const form = new FormData();
        form.append("chat_id", CHANNEL); form.append("caption", text); form.append("parse_mode", "HTML");
        form.append("photo", new Blob([await readFile(file)]), "news-image");
        await api("sendPhoto", form); return "photo";
      }
    } finally { await unlink(file).catch(() => {}); }
  }
  const form = new URLSearchParams({ chat_id: CHANNEL, text, parse_mode: "HTML", disable_web_page_preview: "false" });
  await api("sendMessage", form); return "message";
};

if (!TOKEN) { console.error("Telegram publishing skipped: TELEGRAM_BOT_TOKEN is not configured."); process.exit(0); }
const feed = await readJson(FEED, { items: [] });
const links = await readJson(LINKS, {});
const state = await readJson(STATE, { version:1, initializedAt:null, published:{} });
const items = Array.isArray(feed.items) ? feed.items.filter(n => n && n.title && n.source) : [];

if (mode === "test") {
  const requested = process.env.TEST_SOURCE;
  const item = items.find(n => requested ? n.source === requested : true);
  if (!item) throw new Error("No controlled test item found in assets/news-feed.json");
  console.log("Telegram test item:", item.title);
  try { await send(item, links); console.log("Telegram test succeeded."); }
  catch (error) { console.error("Telegram test failed:", error.message); process.exitCode = 1; }
  process.exit();
}

if (!state.initializedAt) {
  state.initializedAt = new Date().toISOString();
  for (const item of items) state.published[keyFor(item)] = { status:"baseline", initializedAt:state.initializedAt };
  await mkdir("data", { recursive:true }); await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");
  console.log("Telegram publisher initialized safely; historical news was not published.");
  process.exit();
}

const candidates = items.filter(n => !state.published[keyFor(n)] && Date.parse(n.publishedAt || 0) >= Date.parse(state.initializedAt));
for (const item of candidates) {
  try {
    const delivery = await send(item, links);
    state.published[keyFor(item)] = { status:"sent", delivery, sentAt:new Date().toISOString() };
    await mkdir("data", { recursive:true }); await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");
    console.log("Telegram published:", item.title);
  } catch (error) {
    console.error("Telegram publish failed:", item.title, error.message);
  }
}
