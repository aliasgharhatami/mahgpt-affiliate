import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = "https://mahgpt.com";
const affiliate = "https://higgsfield.ai?fpr=ali-asghar-ac573c";
const locales = JSON.parse(fs.readFileSync(path.join(root, "config/locales.json"), "utf8")).supported;
const errors = [];
const fail = (condition, message) => { if (!condition) errors.push(message); };
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const affiliatePattern = escapeRegExp(affiliate);

for (const locale of locales) {
  const relative = `${locale.code === "en" ? "" : `${locale.code}/`}partners/higgsfield.html`;
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    errors.push(`${relative}: missing`);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const expectedCanonical = `${base}/${relative}`;
  fail(html.includes(`<html lang="${locale.hreflang}" dir="${locale.dir}">`), `${relative}: wrong language or direction`);
  fail(html.includes(`<link rel="canonical" href="${expectedCanonical}">`), `${relative}: wrong canonical`);
  for (const alternate of locales) {
    const target = `${base}/${alternate.code === "en" ? "" : `${alternate.code}/`}partners/higgsfield.html`;
    fail(html.includes(`hreflang="${alternate.hreflang}" href="${target}"`), `${relative}: missing ${alternate.hreflang} alternate`);
  }
  fail(html.includes(`hreflang="x-default" href="${base}/partners/higgsfield.html"`), `${relative}: missing x-default`);
  fail(html.includes('data-affiliate-slot="higgsfield-hero"'), `${relative}: missing hero affiliate slot`);
  fail(html.includes('data-affiliate-slot="higgsfield-final"'), `${relative}: missing final affiliate slot`);
  fail((html.match(new RegExp(affiliatePattern, "g")) || []).length >= 8, `${relative}: affiliate URL is not used throughout the page`);

  for (const match of html.matchAll(/<a\b[^>]*class="[^"]*button[^"]*"[^>]*>/gi)) {
    fail(new RegExp(`href="${affiliatePattern}"`).test(match[0]), `${relative}: every CTA button must use the exact affiliate URL`);
    fail(/rel="[^"]*sponsored[^"]*"/.test(match[0]), `${relative}: CTA is missing sponsored rel`);
  }

  const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] || "";
  const withoutLinkedBrand = body.replace(new RegExp(`<a\\b[^>]*href="${affiliatePattern}"[^>]*>[\\s\\S]*?Higgsfield[\\s\\S]*?<\\/a>`, "gi"), "");
  const unlinkedVisibleText = withoutLinkedBrand.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  fail(!/Higgsfield/i.test(unlinkedVisibleText), `${relative}: visible Higgsfield name exists outside the affiliate link`);
  fail(html.includes('id="resolution"') && /1080p/i.test(body), `${relative}: missing 1080p guidance`);
  fail(html.includes('id="music"'), `${relative}: missing music-video guidance`);
  fail(html.includes('data-topic-cluster="video"'), `${relative}: missing internal video-cluster links`);
  fail(html.includes('type="application/ld+json"'), `${relative}: missing structured data`);
  fail(!html.includes('"price":"0"'), `${relative}: must not imply a guaranteed free price`);
  const visible = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  fail(visible.length >= 1600, `${relative}: localized guide is too thin`);
}

if (errors.length) {
  console.error("Higgsfield page validation failed:\n" + errors.join("\n"));
  process.exit(1);
}

console.log(`Higgsfield affiliate guide validation passed for ${locales.length} locales.`);
