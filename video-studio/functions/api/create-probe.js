function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestGet({ env }) {
  if (!env.KIE_API_KEY) {
    return json({ error: 'KIE_API_KEY is not configured on the server.', stage: 'probe-config' }, 503);
  }

  try {
    const upstream = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: '__mahgpt_connectivity_probe__',
        input: { prompt: 'connectivity probe only' }
      })
    });

    const rawText = await upstream.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch {}

    // For the intentionally invalid model, any structured JSON rejection from KIE
    // is a successful connectivity probe. It cannot create a valid generation.
    if (data && typeof data === 'object') {
      return json({
        ok: true,
        endpointReachable: true,
        expectedRejection: true,
        stage: 'kie-createTask-probe',
        upstreamHttpStatus: upstream.status,
        upstreamCode: data?.code ?? null,
        upstreamMessage: data?.msg || data?.message || data?.error || 'Structured KIE response received.'
      });
    }

    return json({
      ok: false,
      endpointReachable: false,
      error: 'KIE createTask returned a non-JSON gateway response during the non-billable connectivity probe.',
      stage: 'kie-createTask-probe',
      upstreamHttpStatus: upstream.status,
      bodyPreview: rawText.slice(0, 300)
    }, 502);
  } catch (error) {
    return json({
      ok: false,
      endpointReachable: false,
      error: error?.message || 'KIE createTask connectivity probe failed.',
      stage: 'mahgpt-createTask-probe'
    }, 502);
  }
}
