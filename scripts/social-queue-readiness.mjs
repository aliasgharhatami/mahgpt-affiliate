import { appendFile, readFile } from "node:fs/promises";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
let queue = null;
try { queue = JSON.parse(await readFile("data/social-queue.json", "utf8")); } catch {}
const refresh = process.env.SOCIAL_QUEUE_FORCE_REFRESH === "true" || !queue?.items?.length || queue.queue_date !== today();
console.log(refresh ? "Today's social queue needs a refresh." : "Today's social queue is already ready.");
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `refresh=${refresh}\n`);
