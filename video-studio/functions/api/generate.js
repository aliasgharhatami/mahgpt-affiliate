function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

const RESOLUTIONS = new Set(['480p', '720p', '1080p']);
const RATIOS = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive']);

function normalizeSeedanceTags(text = '') {
  return String(text)
    .replace(/@image\s*(\d+)/gi, (_, n) => `@Image${Number(n)}`)
    .replace(/@video\s*(\d+)/gi, (_, n) => `@Video${Number(n)}`);
}

function validatePromptReferenceTags(prompt, imageCount, videoCount) {
  const bad = [];
  for (const match of prompt.matchAll(/@Image(\d+)/g)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > imageCount) bad.push(`@Image${n}`);
  }
  for (const match of prompt.matchAll(/@Video(\d+)/g)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > videoCount) bad.push(`@Video${n}`);
  }
  return [...new Set(bad)];
}

function compactUpstreamError(data, rawText, httpStatus) {
  const candidates = [
    data?.msg,
    data?.message,
    data?.error,
    data?.data?.message,
    data?.data?.error,
    rawText
  ];
  const message = candidates.find(v => typeof v === 'string' && v.trim());
  if (message) return String(message).trim().slice(0, 1200);
  return `KIE task creation failed (HTTP ${httpStatus}).`;
}

export async function onRequestPost({ request, env }) {
  if (!env.KIE_API_KEY) return json({ error: 'KIE_API_KEY is not configured on the server.', stage: 'generate-config' }, 503);

  try {
    const body = await request.json();
    const mode = body?.mode === 'reference' ? 'reference' : 'text';
    const prompt = normalizeSeedanceTags(String(body?.prompt || '').trim());
    const images = Array.isArray(body?.images)
      ? body.images.filter(x => typeof x === 'string' && /^https:\/\//i.test(x))
      : [];
    const videos = Array.isArray(body?.videos)
      ? body.videos.filter(x => typeof x === 'string' && /^https:\/\//i.test(x))
      : [];
    const duration = Number(body?.duration);
    const resolution = String(body?.resolution || '');
    const aspectRatio = String(body?.aspectRatio || 'adaptive');
    const generateAudio = body?.generateAudio !== false;

    if (!prompt) return json({ error: 'Prompt is required.' }, 400);
    if (prompt.length > 30000) return json({ error: 'Prompt cannot exceed 30,000 characters.' }, 400);
    if (!Number.isInteger(duration) || duration < 5 || duration > 30) {
      return json({ error: 'Duration must be a whole number from 5 to 30 seconds.' }, 400);
    }
    if (!RESOLUTIONS.has(resolution)) return json({ error: 'Resolution must be 480p, 720p or 1080p.' }, 400);
    if (!RATIOS.has(aspectRatio)) return json({ error: 'Unsupported aspect ratio.' }, 400);
    if (mode === 'reference' && images.length === 0 && videos.length === 0) {
      return json({ error: 'Reference mode requires at least one image or video.' }, 400);
    }

    const badTags = validatePromptReferenceTags(prompt, images.length, videos.length);
    if (badTags.length) {
      return json({ error: `Prompt references ${badTags.join(', ')}, but those reference files were not supplied.` }, 400);
    }

    // Keep the payload aligned with the current KIE Seedance 2.5 schema.
    const input = {
      prompt,
      return_last_frame: false,
      generate_audio: generateAudio,
      resolution,
      aspect_ratio: aspectRatio,
      duration,
      output_format: 'mp4',
      web_search: false,
      nsfw_checker: true
    };

    if (mode === 'reference' && images.length) input.reference_image_urls = images;
    if (mode === 'reference' && videos.length) input.reference_video_urls = videos;

    const requestBody = JSON.stringify({
      model: 'bytedance/seedance-2-5',
      input
    });

    let upstream;
    try {
      upstream = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.KIE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: requestBody
      });
    } catch (fetchError) {
      return json({
        error: fetchError?.message || 'KIE createTask network request failed before a response was received.',
        stage: 'kie-createTask-network'
      }, 502);
    }

    const rawText = await upstream.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!upstream.ok || data?.code !== 200 || !data?.data?.taskId) {
      const message = compactUpstreamError(data, rawText, upstream.status);
      const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      return json({
        error: message,
        upstreamCode: data?.code ?? null,
        upstreamHttpStatus: upstream.status,
        stage: 'kie-createTask',
        responseType: data ? 'json' : 'non-json'
      }, status);
    }

    return json({
      taskId: data.data.taskId,
      stage: 'kie-createTask',
      upstreamHttpStatus: upstream.status,
      upstreamCode: data?.code ?? null,
      requestSummary: {
        model: 'bytedance/seedance-2-5',
        imageCount: images.length,
        videoCount: videos.length,
        duration,
        resolution,
        aspectRatio,
        generateAudio,
        promptChars: prompt.length
      }
    });
  } catch (error) {
    return json({
      error: error?.message || 'Could not create generation task.',
      stage: 'mahgpt-generate'
    }, 500);
  }
}
