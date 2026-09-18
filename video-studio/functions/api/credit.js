function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestGet({ env }) {
  if (!env.KIE_API_KEY) {
    return json({ error: 'KIE_API_KEY is not configured on the server.', stage: 'credit-config' }, 503);
  }

  try {
    const upstream = await fetch('https://api.kie.ai/api/v1/chat/credit', {
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` }
    });

    const rawText = await upstream.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!upstream.ok || data?.code !== 200) {
      const message = data?.msg || data?.message || data?.error ||
        (rawText ? rawText.slice(0, 1000) : null) ||
        `KIE credit check failed (HTTP ${upstream.status}).`;

      return json({
        error: String(message),
        stage: 'kie-credit',
        upstreamHttpStatus: upstream.status,
        upstreamCode: data?.code ?? null
      }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }

    return json({
      ok: true,
      credits: data.data,
      stage: 'kie-credit',
      upstreamHttpStatus: upstream.status,
      upstreamCode: data?.code ?? null
    });
  } catch (error) {
    return json({
      error: error?.message || 'Could not check KIE credits.',
      stage: 'mahgpt-credit'
    }, 500);
  }
}
