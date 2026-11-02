/**
 * MAH GPT Studio – Cloudflare Pages R2 binding check.
 *
 * Exposes no bucket contents and performs no billable R2 object operations.
 * This route must remain diagnostic only until authenticated uploads, quota
 * reservations, rights attestations and deletion are implemented/tested.
 */
export async function onRequestGet(context) {
  const connected = Boolean(context?.env?.STUDIO_MEDIA);
  return new Response(JSON.stringify({
    service: "mah-gpt-studio-media",
    storage_connected: connected,
    uploads_enabled: false,
    customer_media_access: "disabled"
  }), {
    status: connected ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
