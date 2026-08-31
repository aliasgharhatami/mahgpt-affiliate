import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const ORIGIN = "https://mahgpt.com";
export const ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
const root = process.cwd();
const statePath = path.join(root, ".cache", "indexnow-state.json");

export function extractUrls(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m=>m[1].trim());
}
export function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.origin === ORIGIN && u.protocol === "https:" && !u.pathname.startsWith("/go/") && !u.pathname.includes("/404") && !/\.(?:xml|json|txt)$/i.test(u.pathname);
  } catch { return false; }
}
export function collectUrls(sitemapIndex, sitemapFiles) {
  const refs = extractUrls(sitemapIndex);
  const urls = [];
  for (const ref of refs) {
    const local = ref.startsWith(ORIGIN + "/") ? path.join(root, ref.slice((ORIGIN + "/").length)) : null;
    if (local && fs.existsSync(local)) urls.push(...extractUrls(fs.readFileSync(local, "utf8")));
  }
  if (!urls.length) for (const file of sitemapFiles) if (fs.existsSync(file)) urls.push(...extractUrls(fs.readFileSync(file, "utf8")));
  return [...new Set(urls.filter(isValidUrl))].sort();
}
export function digest(urls) { return crypto.createHash("sha256").update(urls.join("\n")).digest("hex"); }

async function main() {
  const index = fs.existsSync("sitemap.xml") ? fs.readFileSync("sitemap.xml", "utf8") : "";
  const files = fs.existsSync("sitemaps") ? fs.readdirSync("sitemaps").filter(f=>f.endsWith(".xml")).map(f=>path.join("sitemaps", f)) : [];
  const urls = collectUrls(index, files);
  if (!urls.length) { console.warn("IndexNow: no valid public URLs; nothing sent."); return; }
  const hash = digest(urls);
  const previous = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
  if (previous.hash === hash) { console.log("IndexNow: sitemap unchanged; duplicate notification skipped."); return; }
  const dry = process.env.INDEXNOW_DRY_RUN !== "false" || !process.env.INDEXNOW_KEY;
  const key = process.env.INDEXNOW_KEY || "DRY_RUN";
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION || ORIGIN + "/indexnow-key.txt";
  const payload = { host: "mahgpt.com", key, keyLocation, urlList: urls };
  if (dry) { console.log(JSON.stringify({ mode: "dry-run", urlCount: urls.length, hash })); return; }
  try {
    const keyResponse = await fetch(keyLocation, {redirect:"follow"});
    const servedKey = (await keyResponse.text()).trim();
    if (!keyResponse.ok || servedKey !== key) throw new Error("public IndexNow key file is missing or does not match the secret");
    const response = await fetch(ENDPOINT, { method: "POST", headers: {"content-type":"application/json; charset=utf-8"}, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("HTTP " + response.status);
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({hash, urlCount:urls.length, notifiedAt:new Date().toISOString()}, null, 2) + "\n");
    console.log("IndexNow: notified " + urls.length + " URLs.");
  } catch (error) {
    console.warn("IndexNow notification failed (non-blocking): " + error.message);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
