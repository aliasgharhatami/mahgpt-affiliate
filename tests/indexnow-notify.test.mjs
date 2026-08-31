import test from "node:test";
import assert from "node:assert/strict";
import { extractUrls, isValidUrl, collectUrls, digest } from "../scripts/indexnow-notify.mjs";

test("extracts sitemap locations", () => {
  assert.deepEqual(extractUrls("<urlset><url><loc>https://mahgpt.com/a.html</loc></url></urlset>"), ["https://mahgpt.com/a.html"]);
});
test("accepts only public indexable MahGPT URLs", () => {
  assert.equal(isValidUrl("https://mahgpt.com/guides/a.html"), true);
  assert.equal(isValidUrl("https://mahgpt.com/go/a.html"), false);
  assert.equal(isValidUrl("https://example.com/a.html"), false);
  assert.equal(isValidUrl("http://mahgpt.com/a.html"), false);
});
test("deduplicates and sorts sitemap URLs", () => {
  const urls=collectUrls("<urlset></urlset>", []);
  assert.ok(Array.isArray(urls));
  assert.equal(digest(["b","a"]), digest(["b","a"]));
  assert.notEqual(digest(["b","a"]), digest(["a","b"]));
});
