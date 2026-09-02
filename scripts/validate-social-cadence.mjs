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

const deliveryCron = "20 5,7,9,11,13,15,17,19,21,23 * * *";
expect(hasCron(socialDelivery, deliveryCron), "social-delivery.yml must run exactly every two hours at :20 UTC slots.");
expect(socialDelivery.includes("workflow_run:"), "social-delivery.yml must hand off after a successful daily news refresh.");
expect(/workflows:\s*\["Refresh MahGPT news"\]/.test(socialDelivery), "social-delivery.yml workflow handoff must only listen to Refresh MahGPT news.");
expect(/types:\s*\[completed\]/.test(socialDelivery), "social-delivery.yml workflow handoff must listen for completed runs.");
expect(!socialDelivery.includes("11,31,51 * * * *"), "social-delivery.yml must not use the temporary every-20-minutes polling cron.");
expect(!hasSchedule(telegramFallback), "publish-social-queue.yml must stay manual-only so it cannot duplicate the unified delivery workflow.");
expect(!hasSchedule(instagramFallback), "test-instagram-publisher.yml must stay manual-only so it cannot duplicate the unified delivery workflow.");
expect(hasCron(updateNews, "17 5 * * *"), "update-news.yml must refresh once daily at 08:17 Europe/Istanbul.");
expect(!updateNews.includes("7,27,47 * * * *"), "update-news.yml must not poll three times per hour.");
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

console.log("Social cadence guard passed: daily 08:17 refresh and two-hour 08:20-02:20 delivery slots are protected.");
