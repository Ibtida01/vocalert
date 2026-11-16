import { analyzePpg, makeSyntheticPpg } from './signal.js';

const WARMUP_SECONDS = 5;
const RECORD_SECONDS = 30;
const TOTAL_SECONDS = WARMUP_SECONDS + RECORD_SECONDS;
const BASELINE_KEY = 'vocalert.baselines.v1';
const HISTORY_KEY = 'vocalert.history.v1';

const $ = (id) => document.getElementById(id);
const state = {
  tab: 'overview', camera: 'off', torch: false, stream: null, stage: 'idle',
  raf: null, lastVideoTime: -1, startedAt: 0, samples: [], latestSamples: [], latest: null,
  latestSource: null, baselines: loadJson(BASELINE_KEY, []), history: loadJson(HISTORY_KEY, []),
  canvasContext: null, lastUi: 0,
};

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function format(value, digits = 1) { return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits); }
function prettyDate(iso) { return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
function setNotice(message) {
  $('notice-text').textContent = message;
  $('notice').hidden = !message;
}
function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showTab(tab) {
  if (tab !== 'measure' && state.stream) stopCamera();
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${tab}-view`; });
  $('results-section').hidden = tab !== 'measure' || !state.latest;
  if (tab === 'baseline') renderBaseline();
  if (tab === 'overview') renderOverviewCounts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.goto)));
$('brand-home').addEventListener('click', (event) => { event.preventDefault(); showTab('overview'); });
$('notice-close').addEventListener('click', () => setNotice(''));
$('overview-demo').addEventListener('click', runSimulation);
$('simulate').addEventListener('click', runSimulation);
$('enable-camera').addEventListener('click', enableCamera);
$('stop-camera').addEventListener('click', stopCamera);
$('torch-toggle').addEventListener('click', toggleTorch);
$('start-capture').addEventListener('click', startCapture);
$('save-summary').addEventListener('click', saveCurrentSummary);
$('export-csv').addEventListener('click', exportCurrentCsv);
$('add-baseline').addEventListener('click', addBaseline);
$('export-bundle').addEventListener('click', exportResearchBundle);
$('export-bundle-research').addEventListener('click', exportResearchBundle);
$('clear-data').addEventListener('click', clearEverything);
$('clear-data-research').addEventListener('click', clearEverything);
$('medical-ack').addEventListener('change', () => { $('enable-camera').disabled = !$('medical-ack').checked; });

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
renderOverviewCounts();

async function enableCamera() {
  setNotice('');
  if (!$('medical-ack').checked) {
    setNotice('Please acknowledge the research-only limitation before opening the camera.');
    return;
  }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    setCameraError('Camera access requires HTTPS (or localhost). Deploy to a secure host such as GitHub Pages, Netlify, or Vercel.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraError('This browser does not expose camera access. Open this app in a recent Android Chrome browser over HTTPS.');
    return;
  }
  $('enable-camera').disabled = true;
  $('enable-camera').textContent = 'Opening camera…';
  setCameraStatus('starting', 'Requesting camera permission…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    state.stream = stream;
    state.camera = 'ready';
    const video = $('camera-video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    const track = stream.getVideoTracks()[0];
    state.torch = false;
    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        await track.applyConstraints({ advanced: [{ torch: true }] });
        state.torch = true;
      }
    } catch { state.torch = false; }
    $('camera-placeholder').hidden = true;
    video.classList.add('visible');
    $('camera-instruction').hidden = false;
    $('enable-camera').hidden = true;
    $('torch-toggle').hidden = false;
    $('torch-toggle').textContent = state.torch ? 'Turn flash off' : 'Try flash';
    $('stop-camera').hidden = false;
    $('start-capture').disabled = false;
    $('camera-message').textContent = state.torch
      ? 'Rear camera ready; torch enabled. Cover the camera and flash with your fingertip.'
      : 'Camera ready. This browser/device did not confirm torch control. If the flash is not on, this capture may fail; try Android Chrome or the demo mode.';
    setCameraStatus('ready', state.torch ? 'Camera + torch ready' : 'Camera ready · torch unconfirmed');
  } catch (error) {
    stopCamera(true);
    const message = error instanceof Error ? error.message : 'Unknown camera error';
    const denied = error?.name === 'NotAllowedError' || /permission/i.test(message);
    setCameraError(denied
      ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
      : `Could not start the camera: ${message}`);
  }
}

function setCameraStatus(kind, text) {
  const el = $('camera-status');
  el.className = `status-label ${kind === 'ready' ? 'status-good' : kind === 'error' ? 'status-bad' : ''}`;
  el.innerHTML = `<span class="status-dot"></span>${text}`;
}
async function toggleTorch() {
  const track = state.stream?.getVideoTracks?.()[0];
  if (!track) return;
  const desired = !state.torch;
  try {
    await track.applyConstraints({ advanced: [{ torch: desired }] });
    state.torch = desired;
    $('torch-toggle').textContent = state.torch ? 'Turn flash off' : 'Turn flash on';
    $('camera-message').textContent = state.torch ? 'Flash is enabled. Cover camera and flash with fingertip.' : 'Flash turned off. Turn it back on before a real measurement.';
    setCameraStatus('ready', state.torch ? 'Camera + torch ready' : 'Camera ready · torch off');
  } catch {
    setNotice('This browser/device does not expose a controllable camera torch. Try another Android phone/browser; do not assume the flash is on.');
  }
}

function setCameraError(message) {
  state.camera = 'error';
  $('camera-message').textContent = message;
  $('enable-camera').hidden = false;
  $('enable-camera').disabled = !$('medical-ack').checked;
  $('enable-camera').textContent = 'Try camera again';
  $('stop-camera').hidden = true;
  setCameraStatus('error', 'Camera unavailable');
}
function stopCamera(fromError = false) {
  if (state.raf != null) cancelAnimationFrame(state.raf);
  state.raf = null;
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  const video = $('camera-video');
  if (video) video.srcObject = null;
  state.torch = false;
  state.camera = fromError ? 'error' : 'off';
  $('camera-instruction').hidden = true;
  $('camera-video').classList.remove('visible');
  $('camera-placeholder').hidden = false;
  $('enable-camera').hidden = false;
  $('enable-camera').disabled = !$('medical-ack').checked;
  $('enable-camera').textContent = fromError ? 'Try camera again' : 'Enable camera';
  $('stop-camera').hidden = true;
  $('torch-toggle').hidden = true;
  $('start-capture').disabled = true;
  if (state.stage === 'warming' || state.stage === 'recording') {
    state.stage = 'idle';
    $('capture-title').textContent = 'Recording stopped';
    $('progress-caption').textContent = 'Incomplete recording discarded';
    $('progress-fill').style.width = '0%';
    $('frame-count').textContent = '0 frames';
  }
  if (!fromError) {
    $('camera-message').textContent = 'Camera is off. Enable it when you are ready to record.';
    setCameraStatus('off', 'Camera not active');
  }
}

function readFrame(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = $('capture-canvas');
  const size = 72;
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  const context = state.canvasContext || canvas.getContext('2d', { willReadFrequently: true });
  state.canvasContext = context;
  if (!context) return null;
  const side = Math.min(video.videoWidth, video.videoHeight) * 0.52;
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  context.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  let r = 0; let g = 0; let b = 0; let luminance = 0; let luminanceSq = 0; let clipped = 0;
  const count = size * size;
  for (let i = 0; i < pixels.length; i += 4) {
    const red = pixels[i]; const green = pixels[i + 1]; const blue = pixels[i + 2];
    r += red; g += green; b += blue;
    const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminance += y; luminanceSq += y * y;
    if (red >= 250 || green >= 250 || blue >= 250 || (red <= 3 && green <= 3 && blue <= 3)) clipped += 1;
  }
  const meanY = luminance / count;
  return {
    t: performance.now(), r: r / count, g: g / count, b: b / count,
    clippedFraction: clipped / count,
    spatialStd: Math.sqrt(Math.max(0, luminanceSq / count - meanY * meanY)),
  };
}

function startCapture() {
  if (!state.stream || state.camera !== 'ready' || state.stage === 'warming' || state.stage === 'recording') return;
  state.samples = []; state.latest = null; state.latestSource = null;
  state.startedAt = performance.now(); state.lastVideoTime = -1; state.stage = 'warming'; state.lastUi = 0;
  $('results-section').hidden = true;
  $('capture-title').textContent = 'Settle the signal';
  $('start-capture').disabled = true;
  $('simulate').disabled = true;
  $('progress-fill').style.width = '0%'; $('progress-caption').textContent = `Warm-up · 0.0 / ${WARMUP_SECONDS}s`;
  $('frame-count').textContent = '0 frames';
  setNotice('Keep still and use light, steady contact. Do not press hard enough to restrict blood flow.');
  const loop = () => {
    const video = $('camera-video');
    const elapsedSec = (performance.now() - state.startedAt) / 1000;
    const inRecording = elapsedSec >= WARMUP_SECONDS;
    if (inRecording && state.stage !== 'recording') {
      state.stage = 'recording';
      $('capture-title').textContent = 'Capturing pulse waveform';
    }
    if (inRecording && video.currentTime !== state.lastVideoTime) {
      const sample = readFrame(video);
      if (sample) {
        sample.t = performance.now() - (state.startedAt + WARMUP_SECONDS * 1000);
        state.samples.push(sample);
        state.lastVideoTime = video.currentTime;
      }
    }
    const measurementElapsed = Math.max(0, elapsedSec - WARMUP_SECONDS);
    if (performance.now() - state.lastUi > 140) {
      $('progress-fill').style.width = `${Math.min(100, (elapsedSec / TOTAL_SECONDS) * 100)}%`;
      $('progress-caption').textContent = inRecording
        ? `Recording · ${Math.min(RECORD_SECONDS, measurementElapsed).toFixed(1)} / ${RECORD_SECONDS}s`
        : `Warm-up · ${Math.min(WARMUP_SECONDS, elapsedSec).toFixed(1)} / ${WARMUP_SECONDS}s`;
      $('frame-count').textContent = `${state.samples.length} frames`;
      state.lastUi = performance.now();
    }
    if (measurementElapsed >= RECORD_SECONDS) {
      state.raf = null;
      finishCapture('camera', state.samples);
      return;
    }
    state.raf = requestAnimationFrame(loop);
  };
  state.raf = requestAnimationFrame(loop);
}

function finishCapture(source, samples) {
  state.stage = 'done';
  state.latestSamples = [...samples];
  state.latestSource = source;
  state.latest = analyzePpg(samples);
  $('capture-title').textContent = 'Recording complete';
  $('progress-fill').style.width = '100%';
  $('progress-caption').textContent = 'Analysis complete';
  $('frame-count').textContent = `${samples.length} frames`;
  $('start-capture').disabled = !state.stream;
  $('simulate').disabled = false;
  $('camera-message').textContent = source === 'camera'
    ? 'Recording complete. Review signal quality before saving or exporting.'
    : 'Synthetic waveform generated for interface testing only.';
  renderResults();
  setNotice(source === 'simulation'
    ? 'SIMULATION ONLY: this synthetic waveform is for testing the interface and signal-processing code. It is not a person or a clinical result.'
    : 'Capture completed. A green quality indicator only means the heuristic checks passed; it does not establish medical accuracy.');
}

function runSimulation() {
  const synthetic = makeSyntheticPpg(32, 76, 30);
  state.samples = synthetic;
  finishCapture('simulation', synthetic);
  showTab('measure');
}

function renderResults() {
  const m = state.latest;
  if (!m) return;
  $('results-section').hidden = false;
  $('result-subtitle').textContent = state.latestSource === 'simulation'
    ? 'Synthetic demonstration signal — never treat this as a human measurement.'
    : 'Exploratory signal features from the latest camera recording.';
  $('simulation-banner').hidden = state.latestSource !== 'simulation';
  $('metric-bpm').textContent = m.bpm == null ? '—' : `${Math.round(m.bpm)}`;
  $('metric-bpm-unit').textContent = m.bpm == null ? 'No reliable estimate' : 'beats / min';
  $('metric-quality').textContent = `${m.qualityScore}`;
  $('metric-quality-detail').textContent = m.quality === 'good' ? 'No major heuristic warning' : m.quality === 'poor' ? 'Repeat the recording' : 'Use caution; inspect warnings';
  $('quality-metric').className = `metric-card ${m.quality === 'good' ? 'metric-good' : m.quality === 'poor' ? 'metric-bad' : 'metric-warn'}`;
  $('metric-cv').textContent = format(m.pulseAmplitudeCvPct);
  $('metric-amplitude').textContent = format(m.relativePulseAmplitudePct, 3);
  $('quality-title').textContent = m.quality === 'good' ? 'No major quality warning' : m.quality === 'usable_with_caution' ? 'Review before using' : 'Please repeat the capture';
  $('quality-score').textContent = m.qualityScore;
  $('quality-pill').textContent = m.quality.replaceAll('_', ' ');
  $('quality-pill').className = `quality-pill quality-${m.quality}`;
  $('quality-flags').replaceChildren();
  m.flags.forEach((flag) => { const li = document.createElement('li'); li.textContent = flag; $('quality-flags').appendChild(li); });
  drawWaveform(m.filtered);
  renderBaselineComparison();
  $('add-baseline').disabled = state.latestSource !== 'camera' || m.quality !== 'good' || m.bpm == null || m.relativePulseAmplitudePct == null;
}

function drawWaveform(values) {
  const width = 900; const height = 230; const pad = 16;
  if (!values.length) { $('waveform-container').textContent = 'No waveform to display.'; return; }
  const stride = Math.max(1, Math.floor(values.length / 900));
  const points = values.filter((_, index) => index % stride === 0);
  const min = Math.min(...points); const max = Math.max(...points); const span = Math.max(1e-8, max - min);
  const polyline = points.map((value, index) => {
    const x = pad + (index / Math.max(1, points.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((value - min) / span) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  $('waveform-container').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Filtered fingertip PPG waveform" class="waveform-svg"><line x1="16" x2="884" y1="57.5" y2="57.5" class="chart-grid"/><line x1="16" x2="884" y1="115" y2="115" class="chart-grid"/><line x1="16" x2="884" y1="172.5" y2="172.5" class="chart-grid"/><polyline points="${polyline}" class="waveform-line" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg><div class="chart-caption"><span>Filtered pulse waveform (0.5–4 Hz)</span><span>${state.latest.samplingRateHz.toFixed(1)} Hz resampled</span></div>`;
}

function getBaselineAverage() {
  if (!state.baselines.length) return null;
  const bpm = mean(state.baselines.map((b) => b.bpm).filter(Number.isFinite));
  const amplitude = mean(state.baselines.map((b) => b.relativePulseAmplitudePct).filter(Number.isFinite));
  const cvs = state.baselines.map((b) => b.pulseAmplitudeCvPct).filter((v) => v != null && Number.isFinite(v));
  return { count: state.baselines.length, bpm, amplitude, cv: mean(cvs) };
}
function renderBaselineComparison() {
  const m = state.latest; const base = getBaselineAverage();
  if (!m || state.latestSource !== 'camera' || !base || !m.bpm || m.relativePulseAmplitudePct == null || !base.amplitude) {
    $('baseline-comparison').hidden = true; return;
  }
  $('baseline-comparison').hidden = false;
  $('compare-bpm').textContent = `${m.bpm - base.bpm > 0 ? '+' : ''}${(m.bpm - base.bpm).toFixed(1)} BPM`;
  const delta = ((m.relativePulseAmplitudePct - base.amplitude) / base.amplitude) * 100;
  $('compare-amplitude').textContent = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
  $('compare-count').textContent = base.count;
}

function saveCurrentSummary() {
  if (!state.latest || !state.latestSource) return;
  const m = state.latest;
  const record = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: state.latestSource,
    metrics: {
      bpm: m.bpm, meanIbiMs: m.meanIbiMs, ibiCount: m.ibiMs.length,
      pulseAmplitudeCvPct: m.pulseAmplitudeCvPct, relativePulseAmplitudePct: m.relativePulseAmplitudePct,
      samplingRateHz: m.samplingRateHz, durationSec: m.durationSec, sampleCount: m.sampleCount,
      qualityScore: m.qualityScore, quality: m.quality, flags: m.flags,
    },
  };
  state.history = [record, ...state.history].slice(0, 100);
  saveJson(HISTORY_KEY, state.history);
  renderOverviewCounts(); renderBaseline();
  setNotice('Measurement summary saved locally in this browser. Raw video and raw frame data were not saved.');
}
function addBaseline() {
  const m = state.latest;
  if (!m || state.latestSource !== 'camera' || m.quality !== 'good' || m.bpm == null || m.relativePulseAmplitudePct == null) {
    setNotice('Only a good-quality real camera recording with a pulse estimate can be added to your local baseline.'); return;
  }
  state.baselines.push({ createdAt: new Date().toISOString(), bpm: m.bpm, relativePulseAmplitudePct: m.relativePulseAmplitudePct, pulseAmplitudeCvPct: m.pulseAmplitudeCvPct });
  state.baselines = state.baselines.slice(-30);
  saveJson(BASELINE_KEY, state.baselines);
  renderBaseline(); renderOverviewCounts(); renderBaselineComparison();
  setNotice('Added to this browser’s local resting reference. For a useful personal reference, collect several comparable resting sessions on different days.');
}
function exportCurrentCsv() {
  const m = state.latest; const samples = state.latestSamples;
  if (!m || !samples.length) return;
  const rows = ['time_seconds,red_channel_mean,green_channel_mean,blue_channel_mean,clipped_fraction,spatial_luminance_std,filtered_red_channel'];
  samples.forEach((sample, i) => {
    const time = sample.t / 1000;
    const filteredIndex = Math.min(m.filtered.length - 1, Math.max(0, Math.round(time * m.samplingRateHz)));
    rows.push([time, sample.r, sample.g, sample.b, sample.clippedFraction, sample.spatialStd, m.filtered[filteredIndex] ?? ''].join(','));
  });
  const metadata = [
    `# source=${state.latestSource}`, `# bpm_estimate=${m.bpm ?? ''}`, `# quality=${m.quality}`,
    `# quality_score=${m.qualityScore}`, `# duration_seconds=${m.durationSec.toFixed(2)}`,
    `# sampling_rate_hz=${m.samplingRateHz.toFixed(2)}`,
    '# NOTE: research prototype only; not a diagnostic or VOC prediction.',
  ].join('\n');
  downloadText(`vocalert-ppg-${new Date().toISOString().replaceAll(':', '-')}.csv`, `${metadata}\n${rows.join('\n')}`, 'text/csv');
}
function exportResearchBundle() {
  const bundle = {
    schema: 'vocalert-research-export-v1', exportedAt: new Date().toISOString(),
    appPurpose: 'Smartphone fingertip PPG signal acquisition and exploratory analysis; not diagnosis or VOC prediction.',
    latestSource: state.latestSource,
    latestMetrics: state.latest ? {
      bpm: state.latest.bpm, meanIbiMs: state.latest.meanIbiMs, ibiMs: state.latest.ibiMs,
      pulseAmplitudeCvPct: state.latest.pulseAmplitudeCvPct,
      relativePulseAmplitudePct: state.latest.relativePulseAmplitudePct,
      samplingRateHz: state.latest.samplingRateHz, durationSec: state.latest.durationSec,
      sampleCount: state.latest.sampleCount, qualityScore: state.latest.qualityScore,
      quality: state.latest.quality, flags: state.latest.flags,
    } : null,
    baselineSummaries: state.baselines, savedMeasurementSummaries: state.history,
  };
  downloadText(`vocalert-research-bundle-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2), 'application/json');
}
function clearEverything() {
  if (!window.confirm('Delete all VOCALERT baseline and saved-summary data stored in this browser? This cannot be undone.')) return;
  localStorage.removeItem(BASELINE_KEY); localStorage.removeItem(HISTORY_KEY);
  state.baselines = []; state.history = [];
  renderBaseline(); renderOverviewCounts(); renderBaselineComparison();
  setNotice('All locally saved baseline and summary data have been deleted.');
}

function renderOverviewCounts() {
  $('overview-baseline-count').textContent = state.baselines.length;
  $('overview-history-count').textContent = state.history.length;
}
function renderBaseline() {
  const base = getBaselineAverage();
  $('baseline-title').textContent = base ? `${base.count} session${base.count === 1 ? '' : 's'} stored` : 'No reference yet';
  $('baseline-bpm').textContent = base ? `${base.bpm.toFixed(1)} BPM` : '—';
  $('baseline-amplitude').textContent = base ? `${base.amplitude.toFixed(3)}%` : '—';
  $('baseline-cv').textContent = !base || base.cv == null ? '—' : `${base.cv.toFixed(1)}%`;
  $('baseline-count').textContent = state.baselines.length;
  $('history-count').textContent = state.history.length;
  const bList = $('baseline-list'); bList.replaceChildren();
  if (!state.baselines.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No baseline sessions saved. Complete a good-quality camera recording and select “Add to resting reference”.'; bList.appendChild(empty);
  } else {
    [...state.baselines].reverse().forEach((item) => {
      const row = document.createElement('div'); row.className = 'history-item';
      const details = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = prettyDate(item.createdAt);
      const subtitle = document.createElement('small'); subtitle.textContent = `${item.bpm.toFixed(1)} BPM · amp ${item.relativePulseAmplitudePct.toFixed(3)}%`;
      details.append(title, subtitle); const dot = document.createElement('span'); dot.className = 'history-dot'; row.append(details, dot); bList.appendChild(row);
    });
  }
  const hList = $('history-list'); hList.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No summaries saved yet. Raw recordings are not automatically stored.'; hList.appendChild(empty);
  } else {
    state.history.slice(0, 12).forEach((item) => {
      const row = document.createElement('div'); row.className = 'history-item';
      const details = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = prettyDate(item.createdAt);
      const bpm = item.metrics.bpm == null ? 'No pulse estimate' : `${item.metrics.bpm.toFixed(1)} BPM`;
      const subtitle = document.createElement('small'); subtitle.textContent = `${item.source} · ${bpm} · quality ${item.metrics.qualityScore}/100`;
      details.append(title, subtitle); const dot = document.createElement('span'); dot.className = `quality-dot quality-dot-${item.metrics.quality}`; row.append(details, dot); hList.appendChild(row);
    });
  }
}

window.addEventListener('pagehide', () => {
  if (state.raf != null) cancelAnimationFrame(state.raf);
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
});
