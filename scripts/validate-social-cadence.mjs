import { readFile } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hasCron = (content, cron) => content.includes(`- cron: "${cron}"`) || content.includes(`- cron: '${cron}'`);
const hasSchedule = content => /\n\s*schedule\s*:/.test(content);

const [
  telegramDelivery,
  telegramManual,
  instagramDelivery,
  updateNews,
  socialQueue,
  telegramPublisher,
  instagramPublisher
] = await Promise.all([
  read(".github/workflows/social-delivery.yml"),
  read(".github/workflows/publish-social-queue.yml"),
  read(".github/workflows/test-instagram-publisher.yml"),
  read(".github/workflows/update-news.yml"),
  read("scripts/social-queue.mjs"),
  read("scripts/social-publisher.mjs"),
  read("scripts/instagram-publisher.mjs")
]);

const deliveryCron = "20 5,7,9,11,13,15,17,19,21,23 * * *";
const backupCron = "40 5,7,9,11,13,15,17,19,21,23 * * *";
const watchdogCron = "*/15 * * * *";

for (const [name, workflow] of [["Telegram", telegramDelivery], ["Instagram", instagramDelivery]]) {
  expect(hasCron(workflow, deliveryCron), `${name} workflow must keep the two-hour :20 UTC delivery slots.`);
  expect(hasCron(workflow, backupCron), `${name} workflow must keep the guarded backup ticks.`);
  expect(hasCron(workflow, watchdogCron), `${name} workflow must include the guarded 15-minute watchdog.`);
  expect(workflow.includes("concurrency:"), `${name} workflow must define concurrency protection.`);
}
expect(telegramDelivery.includes("workflow_run:"), "Telegram workflow must hand off after a successful daily news refresh.");
expect(/workflows:\s*\["Refresh MahGPT news"\]/.test(telegramDelivery), "Telegram workflow handoff must only listen to Refresh MahGPT news.");
expect(/types:\s*\[completed\]/.test(telegramDelivery), "Telegram workflow handoff must listen for completed runs.");
expect(!telegramDelivery.includes("test-instagram-publisher.yml"), "Telegram workflow must not invoke the Instagram workflow.");
expect(!telegramDelivery.includes("instagram-publisher.mjs"), "Telegram workflow must not invoke the Instagram publisher.");
expect(!telegramDelivery.includes("11,31,51 * * * *"), "Telegram workflow must not use the obsolete polling cron.");
expect(!hasSchedule(telegramManual), "publish-social-queue.yml must stay manual-only.");
expect(hasCron(updateNews, "17 5 * * *"), "update-news.yml must refresh once daily at 08:17 Europe/Istanbul.");
expect(!updateNews.includes("7,27,47 * * * *"), "update-news.yml must not poll three times per hour.");
expect(/Date\.UTC\([^)]*,5,20\)/.test(socialQueue), "social-queue.mjs must keep the first queue slot at 08:20 Europe/Istanbul.");
expect(/Array\.from\(\{length:10\}/.test(socialQueue), "social-queue.mjs must keep exactly ten protected daily social slots.");
expect(!telegramPublisher.includes("queue.queue_date!==currentQueueDate"), "Telegram publisher must not reject overnight slots by local date.");
expect(!instagramPublisher.includes("queue.queue_date!==currentQueueDate"), "Instagram publisher must not reject overnight slots by local date.");

for (const [name, source] of [["Telegram", telegramPublisher], ["Instagram", instagramPublisher]]) {
  const match = source.match(/DELIVERY_COOLDOWN_MINUTES\s*=\s*(\d+)/);
  expect(match, `${name} publisher must define DELIVERY_COOLDOWN_MINUTES.`);
  const minutes = Number(match[1]);
  expect(minutes >= 60 && minutes <= 85, `${name} cooldown must prevent bursts without blocking the next two-hour slot.`);
  const windowMatch = source.match(/ELIGIBLE_WINDOW_MINUTES\s*=\s*(\d+)/);
  expect(windowMatch, `${name} publisher must define ELIGIBLE_WINDOW_MINUTES.`);
  const windowMinutes = Number(windowMatch[1]);
  expect(windowMinutes >= 120 && windowMinutes <= 180, `${name} eligibility window must allow delayed slots without replaying stale backlog.`);
}

console.log("Social cadence guard passed: independent Telegram/Instagram workflows, daily refresh, two-hour delivery slots, and watchdog protection are valid.");
