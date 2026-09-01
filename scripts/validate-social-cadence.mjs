import { readFile } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hasCron = (content, cron) => content.includes(`- cron: "${cron}"`) || content.includes(`- cron: '${cron}'`);
const hasSchedule = content => /\n\s*schedule\s*:/.test(content);

const [
  socialDelivery,
  telegramFallback,
  instagramFallback,
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

const deliveryCron = "7,22,37,52 * * * *";
expect(hasCron(socialDelivery, deliveryCron), "social-delivery.yml must use the reliable offset 15-minute watchdog cron.");
expect((socialDelivery.match(/- cron:/g) || []).length === 1, "social-delivery.yml must define exactly one production schedule.");
expect(!socialDelivery.includes("20 5,7,9,11,13,15,17,19,21,23 * * *"), "social-delivery.yml must not rely only on exact two-hour cron slots.");
expect(!socialDelivery.includes("workflow_run:"), "social-delivery.yml must not publish off-cadence after news refresh.");
expect(!socialDelivery.includes("11,31,51 * * * *"), "social-delivery.yml must not use the old temporary polling cron.");
expect(!hasSchedule(telegramFallback), "publish-social-queue.yml must stay manual-only so it cannot duplicate the unified delivery workflow.");
expect(!hasSchedule(instagramFallback), "test-instagram-publisher.yml must stay manual-only so it cannot duplicate the unified delivery workflow.");
expect(hasCron(updateNews, deliveryCron), "update-news.yml must use the reliable offset watchdog cron.");
expect(!updateNews.includes("17 5 * * *"), "update-news.yml must not rely only on an exact refresh minute.");
expect((await read("scripts/social-queue-readiness.mjs")).includes("localMinutes() >= (8 * 60 + 17)"), "refresh readiness must defer stale queues until 08:17 Europe/Istanbul.");
expect(!updateNews.includes("7,27,47 * * * *"), "update-news.yml must not use the old three-times-per-hour poll.");
expect(socialDelivery.includes("mahgpt-content-automation"), "social delivery must share the production concurrency group.");
expect(updateNews.includes("group: mahgpt-content-automation"), "news refresh must share the production concurrency group.");
expect(/Date\.UTC\([^)]*,5,20\)/.test(socialQueue), "social-queue.mjs must keep the first queue slot at 08:20 Europe/Istanbul.");
expect(/Array\.from\(\{length:10\}/.test(socialQueue), "social-queue.mjs must keep exactly ten protected daily social slots.");
expect(!telegramPublisher.includes("queue.queue_date!==currentQueueDate"), "Telegram publisher must not reject the 00:20 and 02:20 overnight slots by local date.");
expect(!instagramPublisher.includes("queue.queue_date!==currentQueueDate"), "Instagram publisher must not reject the 00:20 and 02:20 overnight slots by local date.");

for (const [name, source] of [["Telegram", telegramPublisher], ["Instagram", instagramPublisher]]) {
  const match = source.match(/DELIVERY_COOLDOWN_MINUTES\s*=\s*(\d+)/);
  expect(match, `${name} publisher must define DELIVERY_COOLDOWN_MINUTES.`);
  const minutes = Number(match[1]);
  expect(minutes >= 60 && minutes <= 85, `${name} cooldown must prevent bursts without blocking the next two-hour slot.`);
  const windowMatch = source.match(/ELIGIBLE_WINDOW_MINUTES\s*=\s*(\d+)/);
  expect(windowMatch, `${name} publisher must define ELIGIBLE_WINDOW_MINUTES.`);
  const windowMinutes = Number(windowMatch[1]);
  expect(windowMinutes >= 120 && windowMinutes <= 180, `${name} eligibility window must allow delayed overnight slots without replaying stale backlog.`);
}

console.log("Social cadence guard passed: 15-minute watchdogs with protected two-hour refresh and delivery slots.");
