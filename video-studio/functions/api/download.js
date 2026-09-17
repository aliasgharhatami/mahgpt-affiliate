function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function validTaskId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{6,200}$/.test(value); }

export async function onRequestGet({ request, env }) {
  if (!env.KIE_API_KEY) return json({ error: 'KIE_API_KEY is not configured on the server.' }, 503);
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!validTaskId(taskId)) return json({ error: 'A valid taskId is required.' }, 400);

  try {
    const statusResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` }
    });
    const statusData = await statusResponse.json().catch(() => null);
    if (!statusResponse.ok || statusData?.code !== 200 || statusData?.data?.state !== 'success') {
      return json({ error: statusData?.data?.failMsg || statusData?.msg || 'The video is not ready for download yet.' }, statusResponse.ok ? 409 : statusResponse.status);
    }

    let result = null;
    try { result = typeof statusData.data.resultJson === 'string' ? JSON.parse(statusData.data.resultJson) : statusData.data.resultJson; } catch {}
    const resultUrl = result?.resultUrls?.[0];
    if (!resultUrl || !/^https:\/\//i.test(resultUrl)) return json({ error: 'No downloadable video URL was returned.' }, 502);

    const videoResponse = await fetch(resultUrl);
    if (!videoResponse.ok || !videoResponse.body) return json({ error: 'Could not fetch the generated video.' }, 502);

    const headers = new Headers();
    headers.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="mahgpt-${taskId}.mp4"`);
    headers.set('Cache-Control', 'private, no-store');
    const length = videoResponse.headers.get('Content-Length'); if (length) headers.set('Content-Length', length);
    return new Response(videoResponse.body, { status: 200, headers });
  } catch (error) {
    return json({ error: error?.message || 'Download failed.' }, 500);
  }
}
