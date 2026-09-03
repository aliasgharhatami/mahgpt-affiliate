import { appendFile, readFile } from "node:fs/promises";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const localMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const hour = Number(parts.find(part => part.type === "hour")?.value);
  const minute = Number(parts.find(part => part.type === "minute")?.value);
  return hour * 60 + minute;
};
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
const force = process.env.SOCIAL_QUEUE_FORCE_REFRESH === "true";
const queueOnly = process.env.SOCIAL_QUEUE_ONLY === "true";
const refreshDue = force || localMinutes() >= (8 * 60 + 17);

const reasons = [];
if (force) reasons.push("forced");
if (!queue?.items?.length) reasons.push("missing-social-queue");
if (queue?.items?.length && queue.queue_date !== date && refreshDue) reasons.push("stale-social-queue");
if (!queueOnly) {
  if (!analysis?.analysis_date && refreshDue) reasons.push("missing-daily-analysis-manifest");
  if (analysis?.analysis_date && analysis.analysis_date !== date && refreshDue) reasons.push("stale-daily-analysis");
  if (!analysisPageReady && refreshDue) reasons.push("missing-daily-analysis-page");
}

const refresh = reasons.length > 0;
if (!refresh && queue?.queue_date !== date && !refreshDue) {
  console.log("MahGPT refresh deferred until 08:17 Europe/Istanbul because today's queue is still protected from early rebuild.");
} else {
  console.log(refresh ? "MahGPT daily refresh needed: " + reasons.join(", ") : "Today's social queue and daily analysis are already ready.");
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `refresh=${refresh}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `reason=${reasons.join(",")}\n`);
}
