function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function normalizeSeedanceTags(text = '') {
  return String(text)
    .replace(/@image\s*(\d+)/gi, (_, n) => `@Image${Number(n)}`)
    .replace(/@video\s*(\d+)/gi, (_, n) => `@Video${Number(n)}`);
}

export async function onRequestPost({ request, env }) {
  if (!env.KIE_API_KEY) {
    return json({ error: 'KIE_API_KEY is not configured on the server.', stage: 'payload-probe-config' }, 503);
  }

  try {
    const body = await request.json();
    const prompt = normalizeSeedanceTags(String(body?.prompt || '').trim()).slice(0, 30000);
    const images = Array.isArray(body?.images)
      ? body.images.filter(x => typeof x === 'string' && /^https:\/\//i.test(x))
      : [];
    const videos = Array.isArray(body?.videos)
      ? body.videos.filter(x => typeof x === 'string' && /^https:\/\//i.test(x))
      : [];

    // This is intentionally invalid in two independent ways. KIE should return
    // a structured validation response, proving that the real model route can
    // parse this exact reference/prompt shape without ever creating a billable task.
    const probeInput = {
      prompt: prompt || 'MahGPT non-billable payload validation probe',
      reference_image_urls: images,
      reference_video_urls: videos,
      return_last_frame: false,
      generate_audio: false,
      resolution: '__probe_invalid__',
      aspect_ratio: String(body?.aspectRatio || '16:9'),
      duration: 3,
      output_format: 'mp4',
      web_search: false,
      nsfw_checker: true
    };

    if (!images.length) delete probeInput.reference_image_urls;
    if (!videos.length) delete probeInput.reference_video_urls;

    const upstream = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'bytedance/seedance-2-5',
        input: probeInput
      })
    });

    const rawText = await upstream.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch {}

    if (data && typeof data === 'object') {
      const accidentallyCreated = data?.code === 200 && Boolean(data?.data?.taskId);
      if (accidentallyCreated) {
        return json({
          ok: false,
          endpointReachable: true,
          expectedRejection: false,
          error: 'KIE unexpectedly accepted an intentionally invalid diagnostic payload. Real generation was not submitted by MahGPT after this result.',
          stage: 'kie-payload-probe',
          upstreamHttpStatus: upstream.status,
          upstreamCode: data?.code ?? null
        }, 502);
      }

      return json({
        ok: true,
        endpointReachable: true,
        expectedRejection: true,
        stage: 'kie-payload-probe',
        upstreamHttpStatus: upstream.status,
        upstreamCode: data?.code ?? null,
        upstreamMessage: data?.msg || data?.message || data?.error || 'Structured KIE validation response received.',
        referenceSummary: { imageCount: images.length, videoCount: videos.length, promptChars: prompt.length }
      });
    }

    return json({
      ok: false,
      endpointReachable: false,
      expectedRejection: false,
      error: 'KIE returned a non-JSON gateway response while validating the real Seedance 2.5 payload shape.',
      stage: 'kie-payload-probe',
      upstreamHttpStatus: upstream.status,
      bodyPreview: rawText.slice(0, 300)
    }, 502);
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || 'Seedance payload probe failed.',
      stage: 'mahgpt-payload-probe'
    }, 500);
  }
}
