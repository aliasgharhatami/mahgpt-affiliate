const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-matroska']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv']);
const MAX_REFERENCE_VIDEOS = 3;
const MAX_REFERENCE_VIDEO_SECONDS = 30;
const HISTORY_KEY = 'mahgpt-video-studio-history-v2';

const state = {
  mode: 'text', references: [], duration: 20, resolution: '720p', audio: true,
  aspectRatio: 'adaptive', busy: false, activeTaskId: null, timerStartedAt: null, elapsedTimer: null
};

function show(el, visible = true) { el.classList.toggle('hidden', !visible); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function escapeHtml(value = '') { return value.replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }
function setError(message = '') { const el = $('#formError'); el.textContent = message; show(el, Boolean(message)); }
function toast(message) { const old = $('.toast'); if (old) old.remove(); const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }
function fileExtension(name = '') { const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
function classifyReferenceFile(file) {
  const ext = fileExtension(file?.name);
  if (ALLOWED_IMAGE_TYPES.has(file?.type) || IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ALLOWED_VIDEO_TYPES.has(file?.type) || VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}
function formatSeconds(value) { return Number.isFinite(value) ? `${value.toFixed(value >= 10 ? 1 : 2)}s` : 'duration unknown'; }

function setMode(mode) {
  state.mode = mode;
  $$('.mode').forEach(btn => { const active = btn.dataset.mode === mode; btn.classList.toggle('active', active); btn.setAttribute('aria-selected', String(active)); });
  show($('#referenceSection'), mode === 'reference');
  $('#promptHint').textContent = mode === 'reference'
    ? 'Images use @Image1, @Image2, … and videos use @Video1, @Video2, … in upload order. Tell Seedance what each reference should control.'
    : 'No reference is required in Text → Video mode. Seedance will generate directly from the prompt.';
}

function insertAtCursor(text) {
  const box = $('#prompt'); const start = box.selectionStart ?? box.value.length; const end = box.selectionEnd ?? start;
  const before = box.value.slice(0, start); const after = box.value.slice(end);
  const spacerBefore = before && !/\s$/.test(before) ? ' ' : ''; const spacerAfter = after && !/^\s/.test(after) ? ' ' : '';
  box.value = before + spacerBefore + text + spacerAfter + after;
  const cursor = (before + spacerBefore + text + spacerAfter).length; box.focus(); box.setSelectionRange(cursor, cursor); updateCharCount();
}

function retagReferences() {
  let imageNo = 0, videoNo = 0;
  state.references.forEach(ref => { ref.tag = ref.kind === 'video' ? `@Video${++videoNo}` : `@Image${++imageNo}`; });
}

function renderReferences() {
  retagReferences();
  const grid = $('#referenceGrid'); grid.innerHTML = '';
  state.references.forEach((ref, index) => {
    const card = document.createElement('div');
    card.className = 'reference-card';
    card.style.position = 'relative';
    card.dataset.kind = ref.kind;

    let media;
    if (ref.kind === 'video') {
      media = document.createElement('video');
      media.src = ref.previewUrl; media.muted = true; media.playsInline = true; media.preload = 'metadata';
      media.style.width = '100%'; media.style.aspectRatio = '1 / 1'; media.style.objectFit = 'cover'; media.style.display = 'block'; media.style.background = '#050509';
      media.title = 'Click to preview this video reference';
      media.addEventListener('click', () => { if (media.paused) media.play().catch(() => {}); else media.pause(); });

      const badge = document.createElement('div');
      badge.textContent = '▶ VIDEO';
      badge.style.position = 'absolute'; badge.style.left = '8px'; badge.style.top = '8px'; badge.style.zIndex = '3';
      badge.style.padding = '4px 7px'; badge.style.borderRadius = '999px'; badge.style.fontSize = '10px'; badge.style.fontWeight = '800';
      badge.style.background = 'rgba(0,0,0,.78)'; badge.style.border = '1px solid rgba(255,255,255,.28)'; badge.style.color = '#fff';
      card.appendChild(badge);

      const durationBadge = document.createElement('div');
      durationBadge.textContent = formatSeconds(ref.duration);
      durationBadge.style.position = 'absolute'; durationBadge.style.right = '8px'; durationBadge.style.bottom = '34px'; durationBadge.style.zIndex = '3';
      durationBadge.style.padding = '3px 6px'; durationBadge.style.borderRadius = '6px'; durationBadge.style.fontSize = '9px';
      durationBadge.style.background = 'rgba(0,0,0,.78)'; durationBadge.style.color = '#fff';
      card.appendChild(durationBadge);
    } else {
      media = document.createElement('img'); media.src = ref.previewUrl; media.alt = `Reference image ${ref.tag}`;
      const badge = document.createElement('div');
      badge.textContent = 'IMAGE';
      badge.style.position = 'absolute'; badge.style.left = '8px'; badge.style.top = '8px'; badge.style.zIndex = '3';
      badge.style.padding = '4px 7px'; badge.style.borderRadius = '999px'; badge.style.fontSize = '10px'; badge.style.fontWeight = '800';
      badge.style.background = 'rgba(0,0,0,.72)'; badge.style.border = '1px solid rgba(255,255,255,.2)'; badge.style.color = '#fff';
      card.appendChild(badge);
    }

    const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'reference-tag'; tag.textContent = ref.tag; tag.title = `Insert ${ref.tag} into prompt`; tag.onclick = () => insertAtCursor(ref.tag);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-ref'; remove.textContent = '×'; remove.title = `Remove ${ref.kind}`;
    remove.onclick = () => { URL.revokeObjectURL(ref.previewUrl); state.references.splice(index, 1); renderReferences(); };
    const filename = document.createElement('div');
    filename.textContent = ref.file?.name || ref.kind;
    filename.title = filename.textContent;
    filename.style.fontSize = '9px'; filename.style.opacity = '.7'; filename.style.padding = '4px 4px 0'; filename.style.whiteSpace = 'nowrap'; filename.style.overflow = 'hidden'; filename.style.textOverflow = 'ellipsis';
    card.append(media, tag, remove, filename); grid.appendChild(card);
  });
  show($('#referencesToolbar'), state.references.length > 0);
  const videos = state.references.filter(x => x.kind === 'video');
  const knownDuration = videos.reduce((sum, x) => sum + (Number.isFinite(x.duration) ? x.duration : 0), 0);
  const info = $('#referenceLimits');
  if (info) info.textContent = videos.length ? `${videos.length}/${MAX_REFERENCE_VIDEOS} video refs selected · ${knownDuration.toFixed(1)}s known total (max 30s)` : 'Images up to 30 MB · videos up to 200 MB · up to 3 video refs / 30s total';
}

function getVideoDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const video = document.createElement('video'); video.preload = 'metadata';
    const done = value => { URL.revokeObjectURL(url); resolve(value); };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null); video.src = url;
  });
}

async function addFiles(files) {
  setError('');
  let addedImages = 0, addedVideos = 0;
  for (const file of files) {
    const kind = classifyReferenceFile(file);
    const isImage = kind === 'image'; const isVideo = kind === 'video';
    if (!kind) { setError(`${file.name}: supported files are JPEG, PNG, WebP, MP4, MOV and MKV.`); continue; }
    if (isImage && file.size > MAX_IMAGE_BYTES) { setError(`${file.name}: each image must be 30 MB or smaller.`); continue; }
    if (isVideo && file.size > MAX_VIDEO_BYTES) { setError(`${file.name}: each video must be 200 MB or smaller.`); continue; }
    if (isVideo && state.references.filter(x => x.kind === 'video').length >= MAX_REFERENCE_VIDEOS) { setError(`Seedance reference videos are limited to ${MAX_REFERENCE_VIDEOS} files in this studio.`); continue; }
    const duration = isVideo ? await getVideoDuration(file) : null;
    if (isVideo && Number.isFinite(duration)) {
      const current = state.references.filter(x => x.kind === 'video').reduce((sum, x) => sum + (Number.isFinite(x.duration) ? x.duration : 0), 0);
      if (current + duration > MAX_REFERENCE_VIDEO_SECONDS + 0.05) { setError(`${file.name}: reference videos may total at most 30 seconds.`); continue; }
    }
    state.references.push({ file, kind, duration, previewUrl: URL.createObjectURL(file), uploadedUrl: null, tag: '' });
    if (isVideo) addedVideos++; else addedImages++;
  }
  if (state.references.length) setMode('reference');
  renderReferences();
  if (addedVideos) toast(`${addedVideos} video reference${addedVideos > 1 ? 's' : ''} selected — look for @Video1 below.`);
  else if (addedImages) toast(`${addedImages} image reference${addedImages > 1 ? 's' : ''} selected.`);
}

function updateCharCount() { $('#charCount').textContent = $('#prompt').value.length.toLocaleString(); }
function selectedValue(group) { return $(`.segmented[data-group="${group}"] .selected`)?.dataset.value; }
function readSettings() { state.duration = Number(selectedValue('duration')); state.resolution = selectedValue('resolution'); state.audio = selectedValue('audio') === 'true'; state.aspectRatio = $('#aspectRatio').value; }
function setBusy(busy) { state.busy = busy; $('#generateButton').disabled = busy; $('#generateButton span').textContent = busy ? 'Generation in progress…' : 'Generate video'; }

function resetOutput() { show($('#emptyOutput'), true); show($('#workingOutput'), false); show($('#readyOutput'), false); show($('#failedOutput'), false); show($('#taskBadge'), false); $('#resultVideo').removeAttribute('src'); $('#resultVideo').load(); stopElapsedTimer(); }
function showWorking(stage, taskId = null) {
  show($('#emptyOutput'), false); show($('#workingOutput'), true); show($('#readyOutput'), false); show($('#failedOutput'), false);
  if (taskId) { $('#taskBadge').textContent = taskId; show($('#taskBadge'), true); }
  const steps = { upload: $('#stepUpload'), queue: $('#stepQueue'), generate: $('#stepGenerate'), ready: $('#stepReady') }; Object.values(steps).forEach(el => el.className = '');
  if (stage === 'upload') { $('#statusTitle').textContent = 'Uploading reference media…'; $('#statusDetail').textContent = 'Preparing your images and videos for Seedance.'; steps.upload.className = 'active'; }
  else if (stage === 'queue') { $('#statusTitle').textContent = 'Task submitted…'; $('#statusDetail').textContent = 'Seedance accepted the job and is preparing generation.'; steps.upload.className = 'done'; steps.queue.className = 'active'; }
  else { $('#statusTitle').textContent = 'Creating your video…'; $('#statusDetail').textContent = 'Seedance is processing the prompt and references. This can take several minutes.'; steps.upload.className = 'done'; steps.queue.className = 'done'; steps.generate.className = 'active'; }
}
function startElapsedTimer(startedAt = Date.now()) { stopElapsedTimer(); state.timerStartedAt = startedAt; const tick = () => { const seconds = Math.max(0, Math.floor((Date.now() - state.timerStartedAt) / 1000)); $('#elapsedTime').textContent = `Elapsed ${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }; tick(); state.elapsedTimer = setInterval(tick, 1000); }
function stopElapsedTimer() { if (state.elapsedTimer) clearInterval(state.elapsedTimer); state.elapsedTimer = null; }
function showReady(taskId, resultUrl, entry = {}) { stopElapsedTimer(); setBusy(false); state.activeTaskId = null; show($('#emptyOutput'), false); show($('#workingOutput'), false); show($('#readyOutput'), true); show($('#failedOutput'), false); $('#taskBadge').textContent = taskId; show($('#taskBadge'), true); $('#resultVideo').src = resultUrl; $('#downloadButton').href = `/api/download?taskId=${encodeURIComponent(taskId)}`; $('#resultSummary').textContent = `${entry.duration || state.duration}s · ${entry.resolution || state.resolution} · MP4`; }
function showFailure(message, taskId = null) { stopElapsedTimer(); setBusy(false); state.activeTaskId = null; show($('#emptyOutput'), false); show($('#workingOutput'), false); show($('#readyOutput'), false); show($('#failedOutput'), true); $('#failureMessage').textContent = message || 'Seedance could not complete this task.'; if (taskId) { $('#taskBadge').textContent = taskId; show($('#taskBadge'), true); } }

async function uploadReference(ref, index) {
  if (ref.uploadedUrl) return ref.uploadedUrl;
  $('#statusDetail').textContent = `Uploading ${ref.tag} (${index + 1} of ${state.references.length})…`;
  const body = new FormData(); body.append('file', ref.file, ref.file.name);
  const response = await fetch('/api/upload', { method: 'POST', body }); const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || `Could not upload ${ref.tag}.`); ref.uploadedUrl = data.url; return data.url;
}
async function createTask(payload) { const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.taskId) throw new Error(data.error || 'Could not create the Seedance task.'); return data.taskId; }
async function getTask(taskId) { const response = await fetch(`/api/status?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Could not read task status.'); return data; }
async function pollTask(taskId, startedAt = Date.now()) {
  state.activeTaskId = taskId; startElapsedTimer(startedAt); showWorking('generate', taskId); const maxEnd = Date.now() + 45 * 60 * 1000;
  while (state.activeTaskId === taskId && Date.now() < maxEnd) {
    try {
      const data = await getTask(taskId); const normalized = String(data.state || '').toLowerCase();
      if (normalized === 'success') { const resultUrl = data.resultUrls?.[0]; if (!resultUrl) throw new Error('Seedance completed the task but returned no video URL.'); updateHistory(taskId, { state: 'success', resultUrl, completedAt: Date.now() }); const entry = getHistory().find(x => x.taskId === taskId) || {}; showReady(taskId, resultUrl, entry); renderHistory(); return; }
      if (normalized === 'fail' || normalized === 'failed') { const message = data.failMsg || data.failCode || 'Seedance could not complete this generation.'; updateHistory(taskId, { state: 'fail', failMsg: message, completedAt: Date.now() }); showFailure(message, taskId); renderHistory(); return; }
      showWorking(normalized === 'waiting' ? 'queue' : 'generate', taskId);
    } catch (err) { $('#statusDetail').textContent = `${err.message} Retrying automatically…`; }
    await sleep(8000);
  }
  if (state.activeTaskId === taskId) { setBusy(false); showFailure('The task is still running, but automatic checking timed out. Open it again from Recent generations to continue checking.', taskId); }
}

async function generate() {
  if (state.busy) return; setError(''); readSettings(); const prompt = $('#prompt').value.trim();
  if (!prompt) return setError('Please enter a prompt before generating.');
  if (state.mode === 'reference' && state.references.length === 0) return setError('Add at least one reference image or video, or switch to Text → Video.');
  setBusy(true);
  try {
    const images = [], videos = [];
    if (state.mode === 'reference') {
      showWorking('upload'); startElapsedTimer(); retagReferences();
      for (let i = 0; i < state.references.length; i++) { const ref = state.references[i]; const url = await uploadReference(ref, i); (ref.kind === 'video' ? videos : images).push(url); }
    }
    showWorking('queue');
    const taskId = await createTask({ mode: state.mode, prompt, images, videos, duration: state.duration, resolution: state.resolution, aspectRatio: state.aspectRatio, generateAudio: state.audio });
    const entry = { taskId, state: 'waiting', prompt, mode: state.mode, imageCount: images.length, videoCount: videos.length, duration: state.duration, resolution: state.resolution, aspectRatio: state.aspectRatio, generateAudio: state.audio, createdAt: Date.now() };
    saveHistoryEntry(entry); renderHistory(); await pollTask(taskId, entry.createdAt);
  } catch (err) { showFailure(err.message || 'Something went wrong while starting the generation.'); setError(err.message || 'Generation could not start.'); }
}

function getHistory() { try { const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeHistory(items) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12))); }
function saveHistoryEntry(entry) { const items = getHistory().filter(x => x.taskId !== entry.taskId); items.unshift(entry); writeHistory(items); }
function updateHistory(taskId, patch) { const items = getHistory(); const item = items.find(x => x.taskId === taskId); if (item) Object.assign(item, patch); writeHistory(items); }
function renderHistory() {
  const list = $('#historyList'); const items = getHistory(); if (!items.length) { list.innerHTML = '<p class="history-empty">No generations saved in this browser yet.</p>'; return; }
  list.innerHTML = items.map(item => { const date = new Date(item.createdAt || Date.now()).toLocaleString(); const label = item.state === 'success' ? 'Ready' : item.state === 'fail' ? 'Failed' : 'Working'; const cls = item.state === 'success' ? 'success' : item.state === 'fail' ? 'fail' : ''; const refs = (item.imageCount || item.videoCount) ? ` · ${(item.imageCount || 0)} image / ${(item.videoCount || 0)} video refs` : ''; return `<article class="history-item" data-task="${escapeHtml(item.taskId)}"><div><strong>${escapeHtml(item.prompt || 'Untitled generation')}</strong><p>${escapeHtml(date)} · ${item.duration || '?'}s · ${escapeHtml(item.resolution || '')}${refs}</p></div><span class="history-state ${cls}">${label}</span></article>`; }).join('');
  $$('.history-item').forEach(card => card.addEventListener('click', async () => { const item = getHistory().find(x => x.taskId === card.dataset.task); if (!item) return; state.activeTaskId = item.taskId; setBusy(item.state !== 'success' && item.state !== 'fail'); if (item.state === 'success' && item.resultUrl) showReady(item.taskId, item.resultUrl, item); else if (item.state === 'fail') showFailure(item.failMsg, item.taskId); else await pollTask(item.taskId, item.createdAt || Date.now()); }));
}
async function checkHealth() { const el = $('#apiState'); try { const response = await fetch('/api/health', { cache: 'no-store' }); const data = await response.json(); if (response.ok && data.apiConfigured) { el.classList.add('ok'); el.querySelector('span').textContent = 'API connected'; } else { el.classList.add('bad'); el.querySelector('span').textContent = 'API key missing'; } } catch { el.classList.add('bad'); el.querySelector('span').textContent = 'API unavailable'; } }

$$('.mode').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
$$('.segmented').forEach(group => group.addEventListener('click', e => { const button = e.target.closest('button'); if (!button) return; group.querySelectorAll('button').forEach(b => b.classList.remove('selected')); button.classList.add('selected'); readSettings(); }));
$('#aspectRatio').addEventListener('change', readSettings); $('#prompt').addEventListener('input', updateCharCount);
$('#imageInput').addEventListener('change', async e => { await addFiles([...e.target.files]); e.target.value = ''; });
$('#insertAllTags').addEventListener('click', () => { retagReferences(); insertAtCursor(state.references.map(x => x.tag).join(' ')); });
$('#generateButton').addEventListener('click', generate); $('#newGeneration').addEventListener('click', () => { state.activeTaskId = null; resetOutput(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); $('#retryButton').addEventListener('click', generate); $('#clearHistory').addEventListener('click', () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); toast('Local history cleared'); });
const dropzone = $('#dropzone'); ['dragenter','dragover'].forEach(name => dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.add('drag'); })); ['dragleave','drop'].forEach(name => dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.remove('drag'); })); dropzone.addEventListener('drop', async e => addFiles([...e.dataTransfer.files]));

const fileInput = $('#imageInput');
fileInput.accept = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-matroska,.mp4,.mov,.mkv';
const refSection = $('#referenceSection');
const refLabel = refSection.querySelector('.field-label-row label'); if (refLabel) refLabel.textContent = 'Reference images & videos';
const refMeta = refSection.querySelector('.field-label-row span'); if (refMeta) refMeta.textContent = 'Images: JPEG/PNG/WebP · Videos: MP4/MOV/MKV';
const dzStrong = $('#dropzone strong'); if (dzStrong) dzStrong.textContent = 'Drop images or videos here';
const toolbarCopy = $('#referencesToolbar p'); if (toolbarCopy) toolbarCopy.innerHTML = 'Selected videos appear with a <b>VIDEO</b> badge and use <code>@Video1</code>, <code>@Video2</code>… · Images use <code>@Image1</code>, <code>@Image2</code>…';
const limits = document.createElement('p'); limits.id = 'referenceLimits'; limits.className = 'hint'; limits.style.marginTop = '10px'; refSection.appendChild(limits);
const referenceMode = $('.mode[data-mode="reference"]'); if (referenceMode) { const strong = referenceMode.querySelector('strong'); const small = referenceMode.querySelector('small'); if (strong) strong.textContent = 'References → Video'; if (small) small.textContent = 'Use images and/or videos as references'; }
setMode('text'); readSettings(); updateCharCount(); renderReferences(); renderHistory(); resetOutput(); checkHealth();