import { appendFile, readFile } from "node:fs/promises";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const readJson = async file => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return null; }
};
const exists = async file => {
  try { await readFile(file, "utf8"); return true; }
  catch { return false; }
};

const date = today();
const queue = await readJson("data/social-queue.json");
const analysis = await readJson("assets/daily-analysis.json");
const analysisPageReady = await exists(`news/analysis/${date}.html`);

const reasons = [];
if (process.env.SOCIAL_QUEUE_FORCE_REFRESH === "true") reasons.push("forced");
if (!queue?.items?.length) reasons.push("missing-social-queue");
if (queue?.items?.length && queue.queue_date !== date) reasons.push("stale-social-queue");
if (!analysis?.analysis_date) reasons.push("missing-daily-analysis-manifest");
if (analysis?.analysis_date && analysis.analysis_date !== date) reasons.push("stale-daily-analysis");
if (!analysisPageReady) reasons.push("missing-daily-analysis-page");

const refresh = reasons.length > 0;
console.log(refresh ? "MahGPT daily refresh needed: " + reasons.join(", ") : "Today's social queue and daily analysis are already ready.");
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `refresh=${refresh}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `reason=${reasons.join(",")}\n`);
}
