export function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: true, apiConfigured: Boolean(env.KIE_API_KEY) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
