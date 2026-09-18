function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function validTaskId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{6,200}$/.test(value);
}

export async function onRequestGet({ request, env }) {
  if (!env.KIE_API_KEY) return json({ error: 'KIE_API_KEY is not configured on the server.', stage: 'status-config' }, 503);
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!validTaskId(taskId)) return json({ error: 'A valid taskId is required.' }, 400);

  try {
    const upstream = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` }
    });
    const rawText = await upstream.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch {}
    if (!upstream.ok || data?.code !== 200 || !data?.data) {
      return json({
        error: data?.msg || data?.message || (rawText ? rawText.slice(0, 1000) : null) || `KIE status request failed (HTTP ${upstream.status}).`,
        stage: 'kie-status',
        upstreamHttpStatus: upstream.status,
        upstreamCode: data?.code ?? null
      }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }

    let result = null;
    try { result = typeof data.data.resultJson === 'string' ? JSON.parse(data.data.resultJson) : data.data.resultJson; } catch {}

    return json({
      taskId: data.data.taskId,
      state: data.data.state,
      resultUrls: Array.isArray(result?.resultUrls) ? result.resultUrls : [],
      failCode: data.data.failCode || null,
      failMsg: data.data.failMsg || null,
      costTime: data.data.costTime || null,
      completeTime: data.data.completeTime || null,
      createTime: data.data.createTime || null,
      stage: 'kie-status',
      upstreamHttpStatus: upstream.status,
      upstreamCode: data?.code ?? null
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not query task status.', stage: 'mahgpt-status' }, 500);
  }
}
