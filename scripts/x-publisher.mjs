import { readFile, writeFile, mkdir } from "node:fs/promises";

const QUEUE = "data/social-queue.json";
const HISTORY = "data/x-delivery-history.json";
const API_ORIGIN = "https://api.x.com";
const TOKEN = process.env.X_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.X_REFRESH_TOKEN;
const CLIENT_ID = process.env.X_CLIENT_ID;
const INDEX = process.env.X_QUEUE_INDEX;
const DRY_RUN = process.env.X_DRY_RUN === "true";

const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; } };
const writeJson = async (path, value) => { await mkdir("data", { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + "\n"); };

export const xPostUrl = () => API_ORIGIN + "/2/tweets";
export const normalizeXText = (post) => {
  const headline = String(post.headline || "").trim();
  const summary = String(post.summary || "").trim();
  const url = String(post.mahgpt_url || "").trim();
  const tags = "#AI #TechNews";
  const parts = [headline, summary, "Read more on MahGPT:", url, tags].filter(Boolean);
  let text = parts.join("\n\n");
  if (text.length <= 280) return text;
  const fixed = [headline, "Read more on MahGPT:", url, tags].filter(Boolean).join("\n\n");
  if (fixed.length >= 280) return fixed.slice(0, 280);
  const room = 280 - fixed.length - 2;
  return [headline, summary.slice(0, Math.max(0, room)).replace(/\s+\S*$/, "") + "…", "Read more on MahGPT:", url, tags].join("\n\n").slice(0, 280);
};
export const selectXItem = (queue, history, index = "") => {
  const eligible = queue.items.filter(item => item.x?.status !== "published" && !history.stories?.[item.story_id]?.published_at);
  if (index !== "" && index !== undefined) {
    const item = queue.items[Number(index)];
    if (!item || item.x?.status === "published" || history.stories?.[item.story_id]?.published_at) return null;
    return item;
  }
  return eligible[0] || null;
};
const logError = (status, data) => console.error("X API error:", JSON.stringify({ endpoint: xPostUrl(), http_status: status, error: { type: data?.type || null, code: data?.code || null, message: data?.detail || data?.title || data?.error || "Unknown X API error" } }));
const request = async (token, body) => {
  const response = await fetch(xPostUrl(), { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });
  let data = {}; try { data = await response.json(); } catch {}
  if (!response.ok || data.errors) { logError(response.status, data); const error = new Error(data.detail || data.title || data.errors?.[0]?.message || "X API request failed"); error.status = response.status; throw error; }
  return data;
};
const refresh = async () => {
  if (!REFRESH_TOKEN || !CLIENT_ID) return null;
  const response = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: REFRESH_TOKEN, grant_type: "refresh_token", client_id: CLIENT_ID }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) { logError(response.status, data); return null; }
  return data.access_token;
};
const publish = async text => {
  if (!TOKEN) throw new Error("X_ACCESS_TOKEN is not configured");
  try { return await request(TOKEN, { text }); } catch (error) {
    if (error.status === 401) { const renewed = await refresh(); if (renewed) return request(renewed, { text }); }
    throw error;
  }
};
const main = async () => {
  const queue = await readJson(QUEUE, null); if (!queue?.items?.length) throw new Error("No social queue is available");
  const history = await readJson(HISTORY, { version: 1, stories: {} }); history.stories ||= {};
  const item = selectXItem(queue, history, INDEX); if (!item) throw new Error("No eligible X item found");
  const text = normalizeXText(item);
  const preview = { story_id: item.story_id, headline: item.headline, post_text: text, media_mode: "text-only (safe fallback)" };
  if (DRY_RUN) { console.log("X dry run:", JSON.stringify(preview)); return; }
  const result = await publish(text); const state = { status: "published", published_at: new Date().toISOString(), post_id: result.data?.id || null, media_mode: "text-only" };
  item.x = state; history.stories[item.story_id] = state;
  await writeJson(QUEUE, queue); await writeJson(HISTORY, history);
  console.log("X published one queued item:", JSON.stringify({ story_id: item.story_id, post_id: state.post_id, media_mode: state.media_mode }));
};
if (process.argv[1]?.endsWith("x-publisher.mjs")) main().catch(error => { console.error("X publish failed:", error.message); process.exitCode = 1; });
