const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const HISTORY_KEY = 'mahgpt-video-studio-history-v1';

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
  elapsedTimer: null
};

function show(el, visible = true) { el.classList.toggle('hidden', !visible); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function escapeHtml(value = '') { return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setError(message = '') { const el = $('#formError'); el.textContent = message; show(el, Boolean(message)); }
function toast(message) {
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
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
    ? 'Reference images are mapped in order as @Image1, @Image2, … Use those exact tags in the prompt when you want to point to a specific image.'
    : 'No image is required in Text → Video mode. Seedance will generate directly from the prompt.';
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
  box.focus(); box.setSelectionRange(cursor, cursor); updateCharCount();
}

function renderReferences() {
  const grid = $('#referenceGrid');
  grid.innerHTML = '';
  state.references.forEach((ref, index) => {
    ref.tag = `@Image${index + 1}`;
    const card = document.createElement('div'); card.className = 'reference-card';
    const img = document.createElement('img'); img.src = ref.previewUrl; img.alt = `Reference image ${index + 1}`;
    const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'reference-tag'; tag.textContent = ref.tag; tag.title = `Insert ${ref.tag} into prompt`; tag.onclick = () => insertAtCursor(ref.tag);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-ref'; remove.textContent = '×'; remove.title = 'Remove image';
    remove.onclick = () => {
      URL.revokeObjectURL(ref.previewUrl);
      state.references.splice(index, 1);
      renderReferences();
    };
    card.append(img, tag, remove); grid.appendChild(card);
  });
  show($('#referencesToolbar'), state.references.length > 0);
}

function addFiles(files) {
  setError('');
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { setError(`${file.name}: only JPEG, PNG and WebP are supported.`); continue; }
    if (file.size > MAX_IMAGE_BYTES) { setError(`${file.name}: each image must be 30 MB or smaller.`); continue; }
    state.references.push({ file, previewUrl: URL.createObjectURL(file), uploadedUrl: null, tag: '' });
  }
  if (state.references.length) setMode('reference');
  renderReferences();
}

function updateCharCount() { $('#charCount').textContent = $('#prompt').value.length.toLocaleString(); }

function selectedValue(group) { return $(`.segmented[data-group="${group}"] .selected`)?.dataset.value; }
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
  show($('#emptyOutput'), true); show($('#workingOutput'), false); show($('#readyOutput'), false); show($('#failedOutput'), false); show($('#taskBadge'), false);
  $('#resultVideo').removeAttribute('src'); $('#resultVideo').load();
  stopElapsedTimer();
}

function showWorking(stage, taskId = null) {
  show($('#emptyOutput'), false); show($('#workingOutput'), true); show($('#readyOutput'), false); show($('#failedOutput'), false);
  if (taskId) { $('#taskBadge').textContent = taskId; show($('#taskBadge'), true); }
  const steps = { upload: $('#stepUpload'), queue: $('#stepQueue'), generate: $('#stepGenerate'), ready: $('#stepReady') };
  Object.values(steps).forEach(el => el.className = '');
  if (stage === 'upload') {
    $('#statusTitle').textContent = 'Uploading reference images…'; $('#statusDetail').textContent = 'Preparing your images for Seedance.';
    steps.upload.className = 'active';
  } else if (stage === 'queue') {
    $('#statusTitle').textContent = 'Task submitted…'; $('#statusDetail').textContent = 'Seedance accepted the job and is preparing generation.';
    steps.upload.className = 'done'; steps.queue.className = 'active';
  } else {
    $('#statusTitle').textContent = 'Creating your video…'; $('#statusDetail').textContent = 'Seedance is processing the prompt and references. This can take several minutes.';
    steps.upload.className = 'done'; steps.queue.className = 'done'; steps.generate.className = 'active';
  }
}

function startElapsedTimer(startedAt = Date.now()) {
  stopElapsedTimer(); state.timerStartedAt = startedAt;
  const tick = () => {
    const seconds = Math.max(0, Math.floor((Date.now() - state.timerStartedAt) / 1000));
    const m = String(Math.floor(seconds / 60)).padStart(2, '0'); const s = String(seconds % 60).padStart(2, '0');
    $('#elapsedTime').textContent = `Elapsed ${m}:${s}`;
  };
  tick(); state.elapsedTimer = setInterval(tick, 1000);
}
function stopElapsedTimer() { if (state.elapsedTimer) clearInterval(state.elapsedTimer); state.elapsedTimer = null; }

function showReady(taskId, resultUrl, entry = {}) {
  stopElapsedTimer(); setBusy(false);
  show($('#emptyOutput'), false); show($('#workingOutput'), false); show($('#readyOutput'), true); show($('#failedOutput'), false);
  $('#taskBadge').textContent = taskId; show($('#taskBadge'), true);
  $('#resultVideo').src = resultUrl;
  $('#downloadButton').href = `/api/download?taskId=${encodeURIComponent(taskId)}`;
  const duration = entry.duration || state.duration; const resolution = entry.resolution || state.resolution;
  $('#resultSummary').textContent = `${duration}s · ${resolution} · MP4`;
}

function showFailure(message, taskId = null) {
  stopElapsedTimer(); setBusy(false);
  show($('#emptyOutput'), false); show($('#workingOutput'), false); show($('#readyOutput'), false); show($('#failedOutput'), true);
  $('#failureMessage').textContent = message || 'Seedance could not complete this task.';
  if (taskId) { $('#taskBadge').textContent = taskId; show($('#taskBadge'), true); }
}

async function uploadReference(ref, index) {
  if (ref.uploadedUrl) return ref.uploadedUrl;
  $('#statusDetail').textContent = `Uploading ${ref.tag} (${index + 1} of ${state.references.length})…`;
  const body = new FormData(); body.append('file', ref.file, ref.file.name);
  const response = await fetch('/api/upload', { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || `Could not upload ${ref.tag}.`);
  ref.uploadedUrl = data.url; return data.url;
}

async function createTask(payload) {
  const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.taskId) throw new Error(data.error || 'Could not create the Seedance task.');
  return data.taskId;
}

async function getTask(taskId) {
  const response = await fetch(`/api/status?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not read task status.');
  return data;
}

async function pollTask(taskId, startedAt = Date.now()) {
  state.activeTaskId = taskId; startElapsedTimer(startedAt); showWorking('generate', taskId);
  const maxEnd = Date.now() + 45 * 60 * 1000;
  while (state.activeTaskId === taskId && Date.now() < maxEnd) {
    try {
      const data = await getTask(taskId);
      const normalized = String(data.state || '').toLowerCase();
      if (normalized === 'success') {
        const resultUrl = data.resultUrls?.[0];
        if (!resultUrl) throw new Error('Seedance completed the task but returned no video URL.');
        updateHistory(taskId, { state: 'success', resultUrl, completedAt: Date.now() });
        const entry = getHistory().find(x => x.taskId === taskId) || {};
        showReady(taskId, resultUrl, entry); renderHistory(); return;
      }
      if (normalized === 'fail' || normalized === 'failed') {
        const message = data.failMsg || data.failCode || 'Seedance could not complete this generation.';
        updateHistory(taskId, { state: 'fail', failMsg: message, completedAt: Date.now() });
        showFailure(message, taskId); renderHistory(); return;
      }
      showWorking(normalized === 'waiting' ? 'queue' : 'generate', taskId);
    } catch (err) {
      $('#statusDetail').textContent = `${err.message} Retrying automatically…`;
    }
    await sleep(8000);
  }
  if (state.activeTaskId === taskId) {
    setBusy(false); showFailure('The task is still running, but automatic checking timed out. Open it again from Recent generations to continue checking.', taskId);
  }
}

async function generate() {
  if (state.busy) return;
  setError(''); readSettings();
  const prompt = $('#prompt').value.trim();
  if (!prompt) return setError('Please enter a prompt before generating.');
  if (state.mode === 'reference' && state.references.length === 0) return setError('Add at least one reference image, or switch to Text → Video.');
  setBusy(true);
  try {
    let images = [];
    if (state.mode === 'reference') {
      showWorking('upload'); startElapsedTimer();
      for (let i = 0; i < state.references.length; i++) images.push(await uploadReference(state.references[i], i));
    }
    showWorking('queue');
    const taskId = await createTask({ mode: state.mode, prompt, images, duration: state.duration, resolution: state.resolution, aspectRatio: state.aspectRatio, generateAudio: state.audio });
    const entry = { taskId, state: 'waiting', prompt, mode: state.mode, imageCount: images.length, duration: state.duration, resolution: state.resolution, aspectRatio: state.aspectRatio, generateAudio: state.audio, createdAt: Date.now() };
    saveHistoryEntry(entry); renderHistory();
    await pollTask(taskId, entry.createdAt);
  } catch (err) {
    showFailure(err.message || 'Something went wrong while starting the generation.'); setError(err.message || 'Generation could not start.');
  } finally {
    if (!state.activeTaskId) setBusy(false);
  }
}

function getHistory() {
  try { const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
function writeHistory(items) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12))); }
function saveHistoryEntry(entry) { const items = getHistory().filter(x => x.taskId !== entry.taskId); items.unshift(entry); writeHistory(items); }
function updateHistory(taskId, patch) { const items = getHistory(); const item = items.find(x => x.taskId === taskId); if (item) Object.assign(item, patch); writeHistory(items); }

function renderHistory() {
  const list = $('#historyList'); const items = getHistory();
  if (!items.length) { list.innerHTML = '<p class="history-empty">No generations saved in this browser yet.</p>'; return; }
  list.innerHTML = items.map(item => {
    const date = new Date(item.createdAt || Date.now()).toLocaleString();
    const label = item.state === 'success' ? 'Ready' : item.state === 'fail' ? 'Failed' : 'Working';
    const cls = item.state === 'success' ? 'success' : item.state === 'fail' ? 'fail' : '';
    return `<article class="history-item" data-task="${escapeHtml(item.taskId)}"><div><strong>${escapeHtml(item.prompt || 'Untitled generation')}</strong><p>${escapeHtml(date)} · ${item.duration || '?'}s · ${escapeHtml(item.resolution || '')}</p></div><span class="history-state ${cls}">${label}</span></article>`;
  }).join('');
  $$('.history-item').forEach(card => card.addEventListener('click', async () => {
    const item = getHistory().find(x => x.taskId === card.dataset.task); if (!item) return;
    state.activeTaskId = item.taskId; setBusy(item.state !== 'success' && item.state !== 'fail');
    if (item.state === 'success' && item.resultUrl) showReady(item.taskId, item.resultUrl, item);
    else if (item.state === 'fail') showFailure(item.failMsg, item.taskId);
    else await pollTask(item.taskId, item.createdAt || Date.now());
  }));
}

async function checkHealth() {
  const el = $('#apiState');
  try {
    const response = await fetch('/api/health', { cache: 'no-store' }); const data = await response.json();
    if (response.ok && data.apiConfigured) { el.classList.add('ok'); el.querySelector('span').textContent = 'API connected'; }
    else { el.classList.add('bad'); el.querySelector('span').textContent = 'API key missing'; }
  } catch { el.classList.add('bad'); el.querySelector('span').textContent = 'API unavailable'; }
}

$$('.mode').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
$$('.segmented').forEach(group => group.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  group.querySelectorAll('button').forEach(b => b.classList.remove('selected')); button.classList.add('selected'); readSettings();
}));
$('#aspectRatio').addEventListener('change', readSettings);
$('#prompt').addEventListener('input', updateCharCount);
$('#imageInput').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
$('#insertAllTags').addEventListener('click', () => insertAtCursor(state.references.map((_, i) => `@Image${i + 1}`).join(' ')));
$('#generateButton').addEventListener('click', generate);
$('#newGeneration').addEventListener('click', () => { state.activeTaskId = null; resetOutput(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('#retryButton').addEventListener('click', generate);
$('#clearHistory').addEventListener('click', () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); toast('Local history cleared'); });

const dropzone = $('#dropzone');
['dragenter','dragover'].forEach(name => dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(name => dropzone.addEventListener(name, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));

setMode('text'); readSettings(); updateCharCount(); renderReferences(); renderHistory(); resetOutput(); checkHealth();
