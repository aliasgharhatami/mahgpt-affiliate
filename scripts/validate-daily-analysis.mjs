import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "config/locales.json"), "utf8"));
const manifestPath = path.join(root, "assets/daily-analysis.json");
const errors = [];
const warnings = [];
const strip = html => String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
if (!fs.existsSync(manifestPath)) errors.push("assets/daily-analysis.json: missing");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { analysis_date: "" };
const date = manifest.analysis_date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("assets/daily-analysis.json: invalid analysis_date");
for (const locale of config.supported) {
  const rel = locale.code === "en" ? `news/analysis/${date}.html` : `${locale.code}/news/analysis/${date}.html`;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { errors.push(rel + ": missing daily analysis page"); continue; }
  const html = fs.readFileSync(file, "utf8");
  const visible = strip(html);
  if (visible.length < 1000) errors.push(rel + ": daily analysis is too thin");
  if (!/<link\b[^>]+rel=["']canonical["']/i.test(html)) errors.push(rel + ": missing canonical");
  if (!/<meta\b[^>]+property=["']og:title["']/i.test(html)) errors.push(rel + ": missing og:title");
  if (!/<time\b[^>]+datetime=/i.test(html) && !/article:published_time/i.test(html)) errors.push(rel + ": missing publication date");
  if (!/AnalysisNewsArticle|NewsArticle|Article/.test(html)) errors.push(rel + ": missing article schema");
  for (const wanted of [...config.supported.map(item => item.hreflang), "x-default"]) {
    if (!new RegExp(`hreflang=["']${wanted.replace("-", "[-]")}["']`, "i").test(html)) errors.push(rel + ": missing hreflang " + wanted);
  }
  const sourceLinks = [...html.matchAll(/\/news\/story\.html\?id=/g)].length;
  if (sourceLinks < 3) errors.push(rel + ": needs at least three source story links");
  if (!/MahGPT/.test(visible)) errors.push(rel + ": MahGPT analysis brand not visible");
  if (/This localized MahGPT briefing/.test(visible) && locale.code === "en") warnings.push(rel + ": fallback copy used for English");
}
if (errors.length) {
  console.error("Daily analysis validation failed");
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Daily analysis validation passed for ${config.supported.length} locales.`);
if (warnings.length) console.log(warnings.join("\n"));