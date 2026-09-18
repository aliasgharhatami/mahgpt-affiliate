const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
// Cloudflare Free/Pro proxied request bodies are limited to about 100 MB.
// Keep a little headroom for multipart/form-data overhead.
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-matroska']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv']);
const HISTORY_KEY = 'mahgpt-video-studio-history-v3';

const state = {
  mode: 'text',
  references: [],
  duration: 20,
  resolution: '720p',
  audio: true,
  aspectRatio: 'adaptive',
  busy: false,
  activeTaskId: null,
  timerStartedAt: null,
  elapsedTimer: null,
  runId: null,
  debugEntries: [],
  lastPollState: null
};

function show(el, visible = true) {
  if (el) el.classList.toggle('hidden', !visible);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function setError(message = '') {
  const el = $('#formError');
  if (!el) return;
  el.textContent = message;
  show(el, Boolean(message));
}

function toast(message, type = 'info') {
  const old = $('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function newRunId() {
  return `run-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function safeDiagnosticDetails(details = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value == null) continue;
    if (/key|token|authorization|secret/i.test(key)) continue;
    if (/url/i.test(key)) {
      try { safe[key] = new URL(String(value)).host; } catch { safe[key] = '[redacted-url]'; }
      continue;
    }
    if (typeof value === 'string') safe[key] = value.slice(0, 500);
    else safe[key] = value;
  }
  return safe;
}

function setDiagnosticsState(label, kind = '') {
  const el = $('#diagnosticsState');
  if (!el) return;
  el.textContent = label;
  el.className = `diagnostics-pill ${kind}`.trim();
}

function renderDiagnostics() {
  const out = $('#diagnosticsLog');
  if (!out) return;
  if (!state.debugEntries.length) {
    out.textContent = 'No generation attempt logged yet.';
    return;
  }
  out.textContent = state.debugEntries.map(entry => {
    const details = Object.keys(entry.details || {}).length ? ` ${JSON.stringify(entry.details)}` : '';
    return `[${entry.time}] [${entry.level}] [${entry.stage}] ${entry.message}${details}`;
  }).join('\n');
  out.scrollTop = out.scrollHeight;
}

function debugLog(stage, message, details = {}, level = 'INFO') {
  const entry = {
    time: new Date().toISOString(),
    level,
    stage,
    message: String(message || ''),
    details: safeDiagnosticDetails(details)
  };
  state.debugEntries.push(entry);
  if (state.debugEntries.length > 300) state.debugEntries.shift();
  renderDiagnostics();
}

function clearDiagnostics() {
  state.debugEntries = [];
  state.runId = null;
  state.lastPollState = null;
  const runEl = $('#diagnosticsRunId');
  if (runEl) runEl.textContent = '';
  setDiagnosticsState('Idle');
  renderDiagnostics();
}

async function copyDiagnostics() {
  const text = state.debugEntries.map(entry => {
    const details = Object.keys(entry.details || {}).length ? ` ${JSON.stringify(entry.details)}` : '';
    return `[${entry.time}] [${entry.level}] [${entry.stage}] ${entry.message}${details}`;
  }).join('\n');
  try {
    await navigator.clipboard.writeText(text || 'No diagnostics captured.');
    toast('Diagnostics copied');
  } catch {
    toast('Could not copy diagnostics', 'error');
  }
}

function errorWithDiagnostics(message, details = {}) {
  const err = new Error(message);
  Object.assign(err, details);
  return err;
}

function fileExtension(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function classifyReferenceFile(file) {
  const type = String(file?.type || '').toLowerCase();
  const ext = fileExtension(file?.name);
  if (ALLOWED_IMAGE_TYPES.has(type) || IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ALLOWED_VIDEO_TYPES.has(type) || VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) return 'duration unavailable';
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`;
}

// The KIE Seedance 2.5 API receives image/video references as ordered URL arrays.
// We expose a stable prompt convention and normalize the user's casing before sending.
function normalizeSeedanceTags(text = '') {
  return String(text)
    .replace(/@image\s*(\d+)/gi, (_, n) => `@Image${Number(n)}`)
    .replace(/@video\s*(\d+)/gi, (_, n) => `@Video${Number(n)}`);
}

function setMode(mode) {
  state.mode = mode;
  $$('.mode').forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  show($('#referenceSection'), mode === 'reference');
  $('#promptHint').textContent = mode === 'reference'
    ? 'Reference order is preserved. Use @Image1, @Image2… for images and @Video1, @Video2… for videos. Lowercase variants are normalized automatically before submission.'
    : 'No reference is required in Text → Video mode. Seedance will generate directly from the prompt.';
}

function insertAtCursor(text) {
  const box = $('#prompt');
  const start = box.selectionStart ?? box.value.length;
  const end = box.selectionEnd ?? start;
  const before = box.value.slice(0, start);
  const after = box.value.slice(end);
  const spacerBefore = before && !/\s$/.test(before) ? ' ' : '';
  const spacerAfter = after && !/^\s/.test(after) ? ' ' : '';
  box.value = before + spacerBefore + text + spacerAfter + after;
  const cursor = (before + spacerBefore + text + spacerAfter).length;
  box.focus();
  box.setSelectionRange(cursor, cursor);
  updateCharCount();
}

function retagReferences() {
  let imageNo = 0;
  let videoNo = 0;
  state.references.forEach(ref => {
    ref.tag = ref.kind === 'video' ? `@Video${++videoNo}` : `@Image${++imageNo}`;
  });
}

function getReferenceCounts() {
  return {
    images: state.references.filter(x => x.kind === 'image').length,
    videos: state.references.filter(x => x.kind === 'video').length
  };
}

function ensureReferenceNotice() {
  let notice = $('#referenceNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'referenceNotice';
    notice.className = 'reference-notice hidden';
    $('#referenceSection')?.appendChild(notice);
  }
  return notice;
}

function setReferenceNotice(message = '', kind = 'ok') {
  const notice = ensureReferenceNotice();
  notice.textContent = message;
  notice.className = `reference-notice ${kind === 'error' ? 'error' : 'ok'}`;
  show(notice, Boolean(message));
}

function renderReferences() {
  retagReferences();
  const grid = $('#referenceGrid');
  grid.innerHTML = '';

  state.references.forEach((ref, index) => {
    const card = document.createElement('article');
    card.className = `reference-card reference-card-${ref.kind}`;
    card.dataset.kind = ref.kind;

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'reference-media-wrap';

    let media;
    if (ref.kind === 'video') {
      media = document.createElement('video');
      media.src = ref.previewUrl;
      media.muted = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.controls = true;
      media.className = 'reference-media';
      media.title = `Preview ${ref.tag}`;
    } else {
      media = document.createElement('img');
      media.src = ref.previewUrl;
      media.alt = `Reference image ${ref.tag}`;
      media.className = 'reference-media';
    }

    const kindBadge = document.createElement('span');
    kindBadge.className = `reference-kind-badge ${ref.kind}`;
    kindBadge.textContent = ref.kind === 'video' ? '▶ VIDEO' : 'IMAGE';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-ref';
    remove.textContent = '×';
    remove.title = `Remove ${ref.tag}`;
    remove.onclick = () => {
      URL.revokeObjectURL(ref.previewUrl);
      state.references.splice(index, 1);
      renderReferences();
      const counts = getReferenceCounts();
      setReferenceNotice(state.references.length ? `${counts.images} image reference(s) · ${counts.videos} video reference(s) selected.` : '');
    };

    mediaWrap.append(media, kindBadge, remove);

    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'reference-tag';
    tag.textContent = ref.tag;
    tag.title = `Insert ${ref.tag} into prompt`;
    tag.onclick = () => insertAtCursor(ref.tag);

    const meta = document.createElement('div');
    meta.className = 'reference-meta';
    const details = ref.kind === 'video'
      ? `${formatSeconds(ref.duration)} · ${formatBytes(ref.file?.size)}`
      : formatBytes(ref.file?.size);
    meta.innerHTML = `<strong>${escapeHtml(ref.tag)}</strong><span>${escapeHtml(details)}</span><small title="${escapeHtml(ref.file?.name || '')}">${escapeHtml(ref.file?.name || ref.kind)}</small>`;

    card.append(mediaWrap, tag, meta);
    grid.appendChild(card);
  });

  show($('#referencesToolbar'), state.references.length > 0);
  const counts = getReferenceCounts();
  const info = $('#referenceLimits');
  if (info) {
    info.textContent = state.references.length
      ? `${counts.images} image reference(s) · ${counts.videos} video reference(s) selected. Video files: MP4/MOV/MKV up to 95 MB each.`
      : 'Images up to 30 MB · videos up to 95 MB · MP4/MOV/MKV supported.';
  }
}

function getVideoDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
    setTimeout(() => done(null), 5000);
  });
}

async function addFiles(files) {
  setError('');
  setReferenceNotice('');
  let addedImages = 0;
  let addedVideos = 0;
  const rejected = [];

  for (const file of files) {
    const kind = classifyReferenceFile(file);
    if (!kind) {
      rejected.push(`${file.name}: unsupported format`);
      debugLog('reference-select', 'Rejected reference file', { fileName: file.name, mime: file.type || 'unknown', size: file.size }, 'ERROR');
      continue;
    }

    if (kind === 'image' && file.size > MAX_IMAGE_BYTES) {
      rejected.push(`${file.name}: image is larger than 30 MB`);
      continue;
    }

    if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
      rejected.push(`${file.name}: video is larger than 95 MB`);
      continue;
    }

    const duration = kind === 'video' ? await getVideoDuration(file) : null;
    state.references.push({
      file,
      kind,
      duration,
      previewUrl: URL.createObjectURL(file),
      uploadedUrl: null,
      tag: ''
    });
    debugLog('reference-select', 'Reference accepted in browser', {
      fileName: file.name,
      kind,
      mime: file.type || 'unknown',
      size: file.size,
      duration: Number.isFinite(duration) ? duration : 'unknown'
    });

    if (kind === 'video') addedVideos++;
    else addedImages++;
  }

  if (state.references.length) setMode('reference');
  renderReferences();
  const counts = getReferenceCounts();

  if (addedVideos || addedImages) {
    setReferenceNotice(`${counts.images} image reference(s) · ${counts.videos} video reference(s) selected. ${addedVideos ? 'Video reference accepted and visible below.' : ''}`);
    if (addedVideos) toast(`${addedVideos} video reference${addedVideos > 1 ? 's' : ''} accepted — ${counts.videos === 1 ? '@Video1 is ready' : 'video tags are ready'}.`);
    else toast(`${addedImages} image reference${addedImages > 1 ? 's' : ''} accepted.`);
  }

  if (rejected.length) {
    const message = rejected.join(' · ');
    setReferenceNotice(message, 'error');
    setError(message);
    toast(message, 'error');
  }
}

function updateCharCount() {
  $('#charCount').textContent = $('#prompt').value.length.toLocaleString();
}

function selectedValue(group) {
  return $(`.segmented[data-group="${group}"] .selected`)?.dataset.value;
}

function readSettings() {
  state.duration = Number(selectedValue('duration'));
  state.resolution = selectedValue('resolution');
  state.audio = selectedValue('audio') === 'true';
  state.aspectRatio = $('#aspectRatio').value;
}

function setBusy(busy) {
  state.busy = busy;
  $('#generateButton').disabled = busy;
  $('#generateButton span').textContent = busy ? 'Generation in progress…' : 'Generate video';
}

function resetOutput() {
  show($('#emptyOutput'), true);
  show($('#workingOutput'), false);
  show($('#readyOutput'), false);
  show($('#failedOutput'), false);
  show($('#taskBadge'), false);
  $('#resultVideo').removeAttribute('src');
  $('#resultVideo').load();
  stopElapsedTimer();
}

function showWorking(stage, taskId = null) {
  show($('#emptyOutput'), false);
  show($('#workingOutput'), true);
  show($('#readyOutput'), false);
  show($('#failedOutput'), false);
  if (taskId) {
    $('#taskBadge').textContent = taskId;
    show($('#taskBadge'), true);
  }

  const steps = {
    upload: $('#stepUpload'), queue: $('#stepQueue'), generate: $('#stepGenerate'), ready: $('#stepReady')
  };
  Object.values(steps).forEach(el => el.className = '');

  if (stage === 'upload') {
    $('#statusTitle').textContent = 'Uploading reference media…';
    $('#statusDetail').textContent = 'Preparing your images and videos for Seedance.';
    steps.upload.className = 'active';
  } else if (stage === 'queue') {
    $('#statusTitle').textContent = 'Task submitted…';
    $('#statusDetail').textContent = 'Seedance accepted the job and is preparing generation.';
    steps.upload.className = 'done';
    steps.queue.className = 'active';
  } else {
    $('#statusTitle').textContent = 'Creating your video…';
    $('#statusDetail').textContent = 'Seedance is processing the prompt and references. This can take several minutes.';
    steps.upload.className = 'done';
    steps.queue.className = 'done';
    steps.generate.className = 'active';
  }
}

function startElapsedTimer(startedAt = Date.now()) {
  stopElapsedTimer();
  state.timerStartedAt = startedAt;
  const tick = () => {
    const seconds = Math.max(0, Math.floor((Date.now() - state.timerStartedAt) / 1000));
    $('#elapsedTime').textContent = `Elapsed ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  tick();
  state.elapsedTimer = setInterval(tick, 1000);
}

function stopElapsedTimer() {
  if (state.elapsedTimer) clearInterval(state.elapsedTimer);
  state.elapsedTimer = null;
}

function showReady(taskId, resultUrl, entry = {}) {
  stopElapsedTimer();
  setBusy(false);
  state.activeTaskId = null;
  show($('#emptyOutput'), false);
  show($('#workingOutput'), false);
  show($('#readyOutput'), true);
  show($('#failedOutput'), false);
  $('#taskBadge').textContent = taskId;
  show($('#taskBadge'), true);
  $('#resultVideo').src = resultUrl;
  $('#downloadButton').href = `/api/download?taskId=${encodeURIComponent(taskId)}`;
  $('#resultSummary').textContent = `${entry.duration || state.duration}s · ${entry.resolution || state.resolution} · MP4`;
}

function showFailure(message, taskId = null) {
  stopElapsedTimer();
  setBusy(false);
  state.activeTaskId = null;
  show($('#emptyOutput'), false);
  show($('#workingOutput'), false);
  show($('#readyOutput'), false);
  show($('#failedOutput'), true);
  $('#failureMessage').textContent = message || 'Seedance could not complete this task.';
  if (taskId) {
    $('#taskBadge').textContent = taskId;
    show($('#taskBadge'), true);
  }
}

async function uploadReference(ref, index) {
  if (ref.uploadedUrl) {
    debugLog('upload', `${ref.tag} already uploaded; reusing URL host`, { url: ref.uploadedUrl });
    return ref.uploadedUrl;
  }
  $('#statusDetail').textContent = `Uploading ${ref.tag} (${index + 1} of ${state.references.length})…`;
  debugLog('upload', `Starting upload for ${ref.tag}`, {
    fileName: ref.file?.name,
    kind: ref.kind,
    size: ref.file?.size,
    mime: ref.file?.type || 'unknown'
  });
  const body = new FormData();
  body.append('file', ref.file, ref.file.name);

  let response;
  try {
    response = await fetch('/api/upload', { method: 'POST', body });
  } catch (networkError) {
    debugLog('upload', `Network failure while uploading ${ref.tag}`, { message: networkError?.message }, 'ERROR');
    throw errorWithDiagnostics(`Upload network failure for ${ref.tag}: ${networkError?.message || 'unknown error'}`, { stage: 'upload-network' });
  }

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  debugLog('upload', `Upload response for ${ref.tag}`, {
    httpStatus: response.status,
    stage: data.stage || 'upload-response',
    upstreamHttpStatus: data.upstreamHttpStatus,
    upstreamCode: data.upstreamCode,
    message: data.error || data.message || (response.ok ? 'ok' : raw.slice(0, 300))
  }, response.ok ? 'INFO' : 'ERROR');

  if (!response.ok || !data.url) {
    throw errorWithDiagnostics(data.error || `Could not upload ${ref.tag}.`, {
      stage: data.stage || 'upload-response',
      httpStatus: response.status,
      upstreamHttpStatus: data.upstreamHttpStatus,
      upstreamCode: data.upstreamCode
    });
  }
  if (data.kind && data.kind !== ref.kind) {
    throw errorWithDiagnostics(`${ref.tag} was uploaded but classified unexpectedly as ${data.kind}.`, { stage: 'upload-classification' });
  }
  ref.uploadedUrl = data.url;
  debugLog('upload', `${ref.tag} uploaded successfully`, { kind: data.kind || ref.kind, url: data.url });
  return data.url;
}

async function createTask(payload) {
  debugLog('create-task', 'Sending createTask request to MahGPT backend', {
    mode: payload.mode,
    imageCount: payload.images?.length || 0,
    videoCount: payload.videos?.length || 0,
    duration: payload.duration,
    resolution: payload.resolution,
    aspectRatio: payload.aspectRatio,
    generateAudio: payload.generateAudio,
    promptChars: payload.prompt?.length || 0,
    promptTags: (payload.prompt?.match(/@(Image|Video)\d+/g) || []).join(', ')
  });
  let response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (networkError) {
    debugLog('create-task', 'Network failure before backend response', { message: networkError?.message }, 'ERROR');
    throw errorWithDiagnostics(`Generate network failure: ${networkError?.message || 'unknown error'}`, { stage: 'generate-network' });
  }

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  debugLog('create-task', 'Backend createTask response received', {
    httpStatus: response.status,
    stage: data.stage || 'backend-generate',
    upstreamHttpStatus: data.upstreamHttpStatus,
    upstreamCode: data.upstreamCode,
    message: data.error || data.message || (response.ok ? 'ok' : raw.slice(0, 500)),
    taskId: data.taskId || null
  }, response.ok && data.taskId ? 'INFO' : 'ERROR');

  if (!response.ok || !data.taskId) {
    throw errorWithDiagnostics(data.error || 'Could not create the Seedance task.', {
      stage: data.stage || 'backend-generate',
      httpStatus: response.status,
      upstreamHttpStatus: data.upstreamHttpStatus,
      upstreamCode: data.upstreamCode
    });
  }
  debugLog('create-task', 'KIE task created successfully', { taskId: data.taskId });
  return data.taskId;
}

async function getTask(taskId) {
  let response;
  try {
    response = await fetch(`/api/status?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
  } catch (networkError) {
    debugLog('status', 'Network failure while checking task status', { taskId, message: networkError?.message }, 'ERROR');
    throw errorWithDiagnostics(networkError?.message || 'Status network failure', { stage: 'status-network' });
  }
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    debugLog('status', 'Status endpoint returned an error', {
      taskId,
      httpStatus: response.status,
      stage: data.stage || 'status-response',
      upstreamHttpStatus: data.upstreamHttpStatus,
      upstreamCode: data.upstreamCode,
      message: data.error || raw.slice(0, 300)
    }, 'ERROR');
    throw errorWithDiagnostics(data.error || 'Could not read task status.', {
      stage: data.stage || 'status-response',
      httpStatus: response.status,
      upstreamHttpStatus: data.upstreamHttpStatus,
      upstreamCode: data.upstreamCode
    });
  }
  return data;
}

async function pollTask(taskId, startedAt = Date.now()) {
  state.activeTaskId = taskId;
  startElapsedTimer(startedAt);
  showWorking('generate', taskId);
  const maxEnd = Date.now() + 45 * 60 * 1000;

  while (state.activeTaskId === taskId && Date.now() < maxEnd) {
    try {
      const data = await getTask(taskId);
      const normalized = String(data.state || '').toLowerCase();
      if (normalized !== state.lastPollState) {
        state.lastPollState = normalized;
        debugLog('status', 'Task state changed', {
          taskId,
          state: normalized || 'unknown',
          failCode: data.failCode || null,
          failMsg: data.failMsg || null,
          costTime: data.costTime || null
        }, normalized === 'fail' || normalized === 'failed' ? 'ERROR' : 'INFO');
      }
      if (normalized === 'success') {
        const resultUrl = data.resultUrls?.[0];
        if (!resultUrl) throw new Error('Seedance completed the task but returned no video URL.');
        updateHistory(taskId, { state: 'success', resultUrl, completedAt: Date.now() });
        const entry = getHistory().find(x => x.taskId === taskId) || {};
        debugLog('result', 'Generation completed successfully', { taskId, resultCount: data.resultUrls?.length || 0 });
        setDiagnosticsState('Success', 'ok');
        showReady(taskId, resultUrl, entry);
        renderHistory();
        return;
      }
      if (normalized === 'fail' || normalized === 'failed') {
        const message = data.failMsg || data.failCode || 'Seedance could not complete this generation.';
        updateHistory(taskId, { state: 'fail', failMsg: message, completedAt: Date.now() });
        debugLog('result', 'KIE task failed after creation', { taskId, failCode: data.failCode || null, failMsg: data.failMsg || message }, 'ERROR');
        setDiagnosticsState('Failed', 'error');
        showFailure(message, taskId);
        renderHistory();
        return;
      }
      showWorking(normalized === 'waiting' ? 'queue' : 'generate', taskId);
    } catch (err) {
      $('#statusDetail').textContent = `${err.message} Retrying automatically…`;
    }
    await sleep(8000);
  }

  if (state.activeTaskId === taskId) {
    setBusy(false);
    showFailure('The task is still running, but automatic checking timed out. Open it again from Recent generations to continue checking.', taskId);
  }
}

function validatePromptReferenceTags(prompt, imageCount, videoCount) {
  const bad = [];
  const imageTags = [...prompt.matchAll(/@Image(\d+)/g)].map(m => Number(m[1]));
  const videoTags = [...prompt.matchAll(/@Video(\d+)/g)].map(m => Number(m[1]));

  for (const n of imageTags) {
    if (!Number.isInteger(n) || n < 1 || n > imageCount) bad.push(`@Image${n}`);
  }
  for (const n of videoTags) {
    if (!Number.isInteger(n) || n < 1 || n > videoCount) bad.push(`@Video${n}`);
  }

  if (bad.length) {
    return `Your prompt references ${[...new Set(bad)].join(', ')}, but those reference files are not currently selected.`;
  }
  return '';
}

async function generate() {
  if (state.busy) return;
  clearDiagnostics();
  state.runId = newRunId();
  state.lastPollState = null;
  const runEl = $('#diagnosticsRunId');
  if (runEl) runEl.textContent = state.runId;
  setDiagnosticsState('Running', 'active');
  debugLog('start', 'Generation attempt started', { runId: state.runId });
  setError('');
  readSettings();

  let prompt = $('#prompt').value.trim();
  if (!prompt) {
    debugLog('validation', 'Prompt is empty', {}, 'ERROR');
    setDiagnosticsState('Blocked', 'error');
    return setError('Please enter a prompt before generating.');
  }

  // Normalize common user variants such as @video1 / @IMAGE2 to our ordered reference convention.
  const normalizedPrompt = normalizeSeedanceTags(prompt);
  if (normalizedPrompt !== prompt) {
    prompt = normalizedPrompt;
    $('#prompt').value = prompt;
    updateCharCount();
    toast('Reference tags normalized to @ImageN / @VideoN before submission.');
  }

  if (state.mode === 'reference' && state.references.length === 0) {
    debugLog('validation', 'Reference mode selected with no references', {}, 'ERROR');
    setDiagnosticsState('Blocked', 'error');
    return setError('Add at least one reference image or video, or switch to Text → Video.');
  }

  retagReferences();
  const counts = getReferenceCounts();
  const tagError = validatePromptReferenceTags(prompt, counts.images, counts.videos);
  if (tagError) {
    setReferenceNotice(tagError, 'error');
    debugLog('validation', tagError, { imageCount: counts.images, videoCount: counts.videos }, 'ERROR');
    setDiagnosticsState('Blocked', 'error');
    return setError(tagError);
  }

  setBusy(true);
  try {
    const images = [];
    const videos = [];

    debugLog('validation', 'Input validation passed', {
      mode: state.mode,
      imageCount: counts.images,
      videoCount: counts.videos,
      duration: state.duration,
      resolution: state.resolution,
      aspectRatio: state.aspectRatio,
      generateAudio: state.audio,
      promptChars: prompt.length
    });
    if (state.mode === 'reference') {
      showWorking('upload');
      startElapsedTimer();
      for (let i = 0; i < state.references.length; i++) {
        const ref = state.references[i];
        const url = await uploadReference(ref, i);
        (ref.kind === 'video' ? videos : images).push(url);
      }
    }

    showWorking('queue');
    const taskId = await createTask({
      mode: state.mode,
      prompt,
      images,
      videos,
      duration: state.duration,
      resolution: state.resolution,
      aspectRatio: state.aspectRatio,
      generateAudio: state.audio
    });

    const entry = {
      taskId,
      state: 'waiting',
      prompt,
      mode: state.mode,
      imageCount: images.length,
      videoCount: videos.length,
      duration: state.duration,
      resolution: state.resolution,
      aspectRatio: state.aspectRatio,
      generateAudio: state.audio,
      createdAt: Date.now()
    };
    saveHistoryEntry(entry);
    renderHistory();
    await pollTask(taskId, entry.createdAt);
  } catch (err) {
    debugLog(err.stage || 'exception', err.message || 'Generation could not start', {
      httpStatus: err.httpStatus,
      upstreamHttpStatus: err.upstreamHttpStatus,
      upstreamCode: err.upstreamCode
    }, 'ERROR');
    setDiagnosticsState('Failed', 'error');
    showFailure(err.message || 'Something went wrong while starting the generation.');
    setError(err.message || 'Generation could not start.');
  }
}

function getHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
}

function saveHistoryEntry(entry) {
  const items = getHistory().filter(x => x.taskId !== entry.taskId);
  items.unshift(entry);
  writeHistory(items);
}

function updateHistory(taskId, patch) {
  const items = getHistory();
  const item = items.find(x => x.taskId === taskId);
  if (item) Object.assign(item, patch);
  writeHistory(items);
}

function renderHistory() {
  const list = $('#historyList');
  const items = getHistory();
  if (!items.length) {
    list.innerHTML = '<p class="history-empty">No generations saved in this browser yet.</p>';
    return;
  }

  list.innerHTML = items.map(item => {
    const date = new Date(item.createdAt || Date.now()).toLocaleString();
    const label = item.state === 'success' ? 'Ready' : item.state === 'fail' ? 'Failed' : 'Working';
    const cls = item.state === 'success' ? 'success' : item.state === 'fail' ? 'fail' : '';
    const refs = (item.imageCount || item.videoCount)
      ? ` · ${(item.imageCount || 0)} image / ${(item.videoCount || 0)} video refs`
      : '';
    return `<article class="history-item" data-task="${escapeHtml(item.taskId)}"><div><strong>${escapeHtml(item.prompt || 'Untitled generation')}</strong><p>${escapeHtml(date)} · ${item.duration || '?'}s · ${escapeHtml(item.resolution || '')}${refs}</p></div><span class="history-state ${cls}">${label}</span></article>`;
  }).join('');

  $$('.history-item').forEach(card => card.addEventListener('click', async () => {
    const item = getHistory().find(x => x.taskId === card.dataset.task);
    if (!item) return;
    state.activeTaskId = item.taskId;
    setBusy(item.state !== 'success' && item.state !== 'fail');
    if (item.state === 'success' && item.resultUrl) showReady(item.taskId, item.resultUrl, item);
    else if (item.state === 'fail') showFailure(item.failMsg, item.taskId);
    else await pollTask(item.taskId, item.createdAt || Date.now());
  }));
}

async function checkHealth() {
  const el = $('#apiState');
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok && data.apiConfigured) {
      debugLog('health', 'Backend health check passed; KIE_API_KEY is configured');
      el.classList.add('ok');
      el.querySelector('span').textContent = 'API connected';
    } else {
      debugLog('health', 'Backend health check failed or API key missing', { httpStatus: response.status }, 'ERROR');
      el.classList.add('bad');
      el.querySelector('span').textContent = 'API key missing';
    }
  } catch (err) {
    debugLog('health', 'Backend health request failed', { message: err?.message }, 'ERROR');
    el.classList.add('bad');
    el.querySelector('span').textContent = 'API unavailable';
  }
}

$$('.mode').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
$$('.segmented').forEach(group => group.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button) return;
  group.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
  readSettings();
}));

$('#aspectRatio').addEventListener('change', readSettings);
$('#prompt').addEventListener('input', updateCharCount);
$('#imageInput').addEventListener('change', async e => {
  await addFiles([...e.target.files]);
  e.target.value = '';
});
$('#insertAllTags').addEventListener('click', () => {
  retagReferences();
  insertAtCursor(state.references.map(x => x.tag).join(' '));
});
$('#generateButton').addEventListener('click', generate);
$('#newGeneration').addEventListener('click', () => {
  state.activeTaskId = null;
  resetOutput();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#retryButton').addEventListener('click', generate);
$('#clearHistory').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  toast('Local history cleared');
});
$('#copyDiagnostics')?.addEventListener('click', copyDiagnostics);
$('#clearDiagnostics')?.addEventListener('click', clearDiagnostics);

const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, e => {
  e.preventDefault();
  dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
}));
dropzone.addEventListener('drop', async e => addFiles([...e.dataTransfer.files]));

const fileInput = $('#imageInput');
fileInput.accept = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-matroska,.jpg,.jpeg,.png,.webp,.mp4,.mov,.mkv';

const refSection = $('#referenceSection');
const refLabel = refSection.querySelector('.field-label-row label');
if (refLabel) refLabel.textContent = 'Reference images & videos';
const refMeta = refSection.querySelector('.field-label-row span');
if (refMeta) refMeta.textContent = 'Images: JPEG/PNG/WebP · Videos: MP4/MOV/MKV';
const dzStrong = $('#dropzone strong');
if (dzStrong) dzStrong.textContent = 'Drop images or videos here';
const toolbarCopy = $('#referencesToolbar p');
if (toolbarCopy) toolbarCopy.innerHTML = 'Accepted videos are shown as <b>VIDEO</b> cards with <code>@Video1</code>, <code>@Video2</code>… · images use <code>@Image1</code>, <code>@Image2</code>…';
const limits = document.createElement('p');
limits.id = 'referenceLimits';
limits.className = 'hint';
limits.style.marginTop = '10px';
refSection.appendChild(limits);
ensureReferenceNotice();

const referenceMode = $('.mode[data-mode="reference"]');
if (referenceMode) {
  const strong = referenceMode.querySelector('strong');
  const small = referenceMode.querySelector('small');
  if (strong) strong.textContent = 'References → Video';
  if (small) small.textContent = 'Use images and/or videos as references';
}

clearDiagnostics();
setMode('text');
readSettings();
updateCharCount();
renderReferences();
renderHistory();
resetOutput();
checkHealth();
