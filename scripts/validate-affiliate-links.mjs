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

console.log("Affiliate link guard passed: Descript, SOUNDRAW and Pictory redirects are intact.");
