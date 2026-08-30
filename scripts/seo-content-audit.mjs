import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = [];
const errors = [];
const warnings = [];
const ignored = new Set(["node_modules", ".git", "dist", "assets/social-cards"]);
const pagePath = file => path.relative(root, file).replaceAll(path.sep, "/");
const walk = dir => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(full);
  }
};
walk(root);
const pages = new Set(htmlFiles.map(pagePath));
const strip = value => String(value || "").split("#")[0].split("?")[0];
const resolveLocal = (href, from) => {
  const clean = strip(href);
  if (!clean || /^(?:https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(clean)) return null;
  const candidate = clean.startsWith("/")
    ? clean.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(pagePath(from)), clean));
  return candidate.replace(/^\.\//, "");
};
const targetExists = candidate => {
  if (!candidate) return true;
  if (candidate.endsWith("/")) return pages.has(candidate + "index.html");
  return pages.has(candidate) || pages.has(candidate + ".html") || pages.has(candidate + "/index.html");
};
const text = html => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => tag.match(new RegExp(name + "[\\s\\t\\r\\n]*=[\\s\\t\\r\\n]*[\"']([^\"']*)", "i"))?.[1] || "";
const isUtility = file => /^(?:about|affiliate-disclosure|editorial-policy|partner-with-mahgpt)\.html$/.test(file);
const isEditorial = file => /^(?:guides|news)(?:\/|$)/.test(file) || /partners\//.test(file);

const inbound = new Map([...pages].map(p => [p, 0]));
for (const file of htmlFiles) {
  const name = pagePath(file);
  const html = fs.readFileSync(file, "utf8");
  const visible = text(html);
  const h1 = [...html.matchAll(/<h1\b[^>]*>/gi)].length;
  const h2 = [...html.matchAll(/<h2\b[^>]*>/gi)].length;
  if (!h1 && !isUtility(name)) warnings.push(name + ": missing h1");
  if (h1 > 1) warnings.push(name + ": multiple h1 elements (" + h1 + ")");
  if (isEditorial(name) && h2 === 0) warnings.push(name + ": editorial page has no h2");
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map(m => Number(m[1]));
  for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) warnings.push(name + ": skipped heading level h" + headings[i]);
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = attr(tag, "alt");
    const decorative = /aria-hidden=[\"']true|role=[\"']presentation/i.test(tag);
    if (!/\balt\s*=/.test(tag)) errors.push(name + ": image missing alt");
    else if (!alt.trim() && !decorative) warnings.push(name + ": non-decorative image has empty alt");
  }
  for (const match of html.matchAll(/<(?:a|link|script|img)\b[^>]*(?:href|src)=[\"']([^\"']+)[\"'][^>]*>/gi)) {
    const target = resolveLocal(match[1], file);
    if (target) {
      if (!targetExists(target)) errors.push(name + ": broken local target " + match[1]);
      else if (pages.has(target)) inbound.set(target, (inbound.get(target) || 0) + 1);
      else if (pages.has(target + ".html")) inbound.set(target + ".html", (inbound.get(target + ".html") || 0) + 1);
    }
  }
  const breadcrumb = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  if (breadcrumb) {
    try {
      const data = JSON.parse(breadcrumb[1]);
      const graph = data["@graph"] || [data];
      for (const item of graph) {
        if (item["@type"] === "BreadcrumbList") {
          if (!Array.isArray(item.itemListElement) || item.itemListElement.length < 2) errors.push(name + ": BreadcrumbList needs at least two items");
          for (const crumb of item.itemListElement || []) if (!crumb.name || !crumb.position) errors.push(name + ": invalid breadcrumb item");
        }
        if (item["@type"] === "Article" || item["@type"] === "NewsArticle") {
          if (!item.headline || !item.datePublished || !item.author) errors.push(name + ": incomplete Article schema");
          if (!visible.includes(String(item.headline))) warnings.push(name + ": Article headline not visible");
        }
      }
    } catch { errors.push(name + ": invalid JSON-LD"); }
  }
  if (isEditorial(name) && !/<time\b[^>]*datetime=|article:published_time/i.test(html)) warnings.push(name + ": missing visible publication date");
}
for (const [file, count] of inbound) if (!count && !isUtility(file) && file !== "index.html") warnings.push(file + ": orphan candidate (no internal inbound link)");
const report = { pages: htmlFiles.length, errors, warnings };
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/seo-content-audit.json", JSON.stringify(report, null, 2) + "\n");
if (errors.length) {
  console.error("SEO content audit failed with " + errors.length + " error(s)");
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("SEO content audit passed for " + htmlFiles.length + " HTML pages.");
console.log("Warnings: " + warnings.length + " (see reports/seo-content-audit.json)");
