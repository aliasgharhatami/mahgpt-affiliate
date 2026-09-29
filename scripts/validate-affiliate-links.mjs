import { readFile } from "node:fs/promises";

const expected = {
  descript: {
    path: "go/descript.html",
    redirectPath: "/go/descript.html",
    target: "https://get.descript.com/35sevxkoxqev"
  },
  soundraw: {
    path: "go/soundraw.html",
    redirectPath: "/go/soundraw.html",
    target: "https://soundraw.io/?ref=jwgoliii"
  },
  pictory: {
    path: "go/pictory.html",
    redirectPath: "/go/pictory.html",
    target: "https://pictory.ai?fpr=ali-asghar30"
  },
  invideo: {
    path: "go/invideo.html",
    redirectPath: "/go/invideo.html",
    target: "https://invideo.sjv.io/c/7652874/883681/12258"
  }
};

const links = JSON.parse(await readFile("config/social-affiliate-links.json", "utf8"));
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const [partner, spec] of Object.entries(expected)) {
  const entry = links[partner] || {};
  expect(entry.status === "active", `${partner} must stay marked as an active affiliate partner.`);
  expect(entry.affiliateUrl === spec.target, `${partner} affiliateUrl changed or is missing.`);
  expect(entry.redirectPath === spec.redirectPath, `${partner} redirectPath must use the .html redirect URL.`);
  expect(!entry.redirectPath.endsWith("/"), `${partner} redirectPath must not use a directory-style /go/.../ URL.`);

  const html = await readFile(spec.path, "utf8");
  expect(html.includes(spec.target), `${spec.path} no longer points to the expected affiliate URL.`);
  expect(html.includes('content="1;url=' + spec.target + '"'), `${spec.path} meta refresh target changed.`);
  expect(html.includes('href="' + spec.target + '"'), `${spec.path} button target changed.`);
  expect(/<meta name="robots" content="noindex">/.test(html), `${spec.path} must remain noindex.`);
}

const invideoPages = [
  "partners/invideo.html",
  ...["es", "de", "fr", "pt-BR", "ar", "fa", "tr", "it", "ja", "ko", "id", "hi"]
    .map(locale => `${locale}/partners/invideo.html`)
];

for (const page of invideoPages) {
  const html = await readFile(page, "utf8");
  expect(html.includes('href="/go/invideo.html"'), `${page} must contain the protected InVideo affiliate route.`);
  expect(!/data-affiliate-slot="[^"]*invideo[^"]*"[^>]+href="https:\/\/invideo\.io\/?"/i.test(html), `${page} still has an untracked InVideo CTA.`);
  const commercialLinks = [...html.matchAll(/<a\b[^>]*href="\/go\/invideo\.html"[^>]*>/gi)].map(match => match[0]);
  expect(commercialLinks.length >= 2, `${page} must expose both an InVideo CTA and an in-body brand link.`);
  for (const link of commercialLinks) {
    expect(/rel="[^"]*\bsponsored\b[^"]*"/i.test(link), `${page} has an InVideo commercial link without rel=sponsored.`);
  }
  expect(/class="affiliate-brand"[^>]+href="\/go\/invideo\.html"/.test(html), `${page} must link in-body InVideo mentions through the protected route.`);
  expect(/id="invideo-v4-[^"]+"/.test(html), `${page} is missing the localized InVideo v4.0 feature section.`);
}

console.log("Affiliate link guard passed: Descript, SOUNDRAW, Pictory and InVideo redirects are intact across all supported locales.");
