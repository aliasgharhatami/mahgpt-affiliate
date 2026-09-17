function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 30 * 1024 * 1024;

function safeName(name = 'image') {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'image';
}

export async function onRequestPost({ request, env }) {
  if (!env.KIE_API_KEY) return json({ error: 'KIE_API_KEY is not configured on the server.' }, 503);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'No image file was provided.' }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'Only JPEG, PNG and WebP images are supported.' }, 415);
    if (file.size > MAX_BYTES) return json({ error: 'Each image must be 30 MB or smaller.' }, 413);

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
    const outgoing = new FormData();
    outgoing.append('file', file, uniqueName);
    outgoing.append('uploadPath', 'mahgpt-video-studio/images');
    outgoing.append('fileName', uniqueName);

    const upstream = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.KIE_API_KEY}` },
      body: outgoing
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !data?.success) {
      return json({ error: data?.msg || data?.message || `KIE upload failed (${upstream.status}).` }, upstream.status >= 400 ? upstream.status : 502);
    }

    const url = data?.data?.downloadUrl || data?.data?.fileUrl;
    if (!url) return json({ error: 'KIE uploaded the image but returned no usable URL.' }, 502);
    return json({ url, fileName: data?.data?.fileName || uniqueName, expiresAt: data?.data?.expiresAt || null });
  } catch (error) {
    return json({ error: error?.message || 'Image upload failed.' }, 500);
  }
}
