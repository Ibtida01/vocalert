const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const median = (values) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
const std = (values) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((x) => (x - m) ** 2)));
};

function biquad(input, fs, cutoff, type) {
  const omega = 2 * Math.PI * cutoff / fs;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = sin / (2 * Math.SQRT1_2);
  let b0; let b1; let b2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  } else {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  }
  b0 /= a0; b1 /= a0; b2 /= a0;
  const na1 = a1 / a0; const na2 = a2 / a0;
  const output = new Array(input.length).fill(0);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - na1 * y1 - na2 * y2;
    output[i] = Number.isFinite(y0) ? y0 : 0;
    x2 = x1; x1 = x0; y2 = y1; y1 = output[i];
  }
  return output;
}

function resampleUniform(samples, fs) {
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const duration = (end - start) / 1000;
  const count = Math.floor(duration * fs) + 1;
  const values = [];
  const times = [];
  let j = 0;
  for (let i = 0; i < count; i += 1) {
    const targetMs = start + (i * 1000) / fs;
    while (j < samples.length - 2 && samples[j + 1].t < targetMs) j += 1;
    const left = samples[j];
    const right = samples[Math.min(j + 1, samples.length - 1)];
    const span = right.t - left.t;
    const fraction = span > 0 ? clamp((targetMs - left.t) / span, 0, 1) : 0;
    values.push(left.r + (right.r - left.r) * fraction);
    times.push(i / fs);
  }
  return { values, times };
}

function detectPeaks(signal, fs) {
  const m = mean(signal);
  const s = std(signal);
  if (!Number.isFinite(s) || s < 1e-7) return [];
  const threshold = m + 0.12 * s;
  const minDistance = Math.max(1, Math.floor(fs * 60 / 190));
  const candidates = [];
  for (let i = 1; i < signal.length - 1; i += 1) {
    if (signal[i] > signal[i - 1] && signal[i] >= signal[i + 1] && signal[i] > threshold) {
      if (candidates.length && i - candidates[candidates.length - 1] < minDistance) {
        const last = candidates[candidates.length - 1];
        if (signal[i] > signal[last]) candidates[candidates.length - 1] = i;
      } else candidates.push(i);
    }
  }
  return candidates;
}

export function analyzePpg(samples) {
  const ordered = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.r)).sort((a, b) => a.t - b.t);
  const durationSec = ordered.length > 1 ? (ordered[ordered.length - 1].t - ordered[0].t) / 1000 : 0;
  const intervals = ordered.slice(1).map((s, i) => s.t - ordered[i].t).filter((x) => x > 0);
  const medianDt = median(intervals);
  const measuredFs = Number.isFinite(medianDt) && medianDt > 0 ? 1000 / medianDt : 0;
  const fs = measuredFs > 0 ? Math.min(30, measuredFs) : 0;
  const safeFs = Math.max(1, fs);
  const uniform = ordered.length >= 3 ? resampleUniform(ordered, safeFs) : { values: ordered.map((s) => s.r), times: ordered.map((s) => (s.t - (ordered[0]?.t ?? 0)) / 1000) };
  const meanRed = mean(ordered.map((s) => s.r));
  const centered = uniform.values.map((v) => v - mean(uniform.values));
  let filtered = centered;
  if (fs > 8) {
    filtered = biquad(filtered, fs, 0.5, 'highpass');
    filtered = biquad(filtered, fs, Math.min(4, fs * 0.40), 'lowpass');
  }
  const startIndex = Math.min(filtered.length - 1, Math.floor(fs * 1.5));
  const detectionSignal = filtered.slice(Math.max(0, startIndex));
  const localPeaks = fs >= 10 ? detectPeaks(detectionSignal, fs) : [];
  const peakIndices = localPeaks.map((i) => i + Math.max(0, startIndex));
  const candidateIbis = peakIndices.slice(1).map((p, i) => ((p - peakIndices[i]) / fs) * 1000);
  const ibiMs = candidateIbis.filter((ibi) => ibi >= 333 && ibi <= 1500);
  const bpm = ibiMs.length >= 2 ? 60000 / median(ibiMs) : null;
  const meanIbiMs = ibiMs.length ? mean(ibiMs) : null;
  const pulseAmplitudes = [];
  for (let k = 0; k < peakIndices.length - 1; k += 1) {
    const a = peakIndices[k]; const b = peakIndices[k + 1];
    if (b - a < 2) continue;
    let trough = Infinity;
    for (let i = a; i <= b; i += 1) trough = Math.min(trough, filtered[i]);
    const amp = filtered[a] - trough;
    if (amp > 0) pulseAmplitudes.push(amp);
  }
  const ampMean = mean(pulseAmplitudes);
  const pulseAmplitudeCvPct = pulseAmplitudes.length >= 3 && ampMean > 0 ? (std(pulseAmplitudes) / ampMean) * 100 : null;
  const relativePulseAmplitudePct = meanRed > 0 && ampMean > 0 ? (ampMean / meanRed) * 100 : null;
  const clippedFraction = mean(ordered.map((s) => s.clippedFraction));
  const jitter = intervals.length > 2 ? std(intervals) / Math.max(1, mean(intervals)) : 1;
  const validIntervals = candidateIbis.length ? ibiMs.length / candidateIbis.length : 0;
  const pulseStd = std(filtered);
  const flags = [];
  let score = 100;
  if (durationSec < 25) { flags.push('Recording is shorter than the recommended 30 seconds.'); score -= 25; }
  if (fs < 18) { flags.push('Frame sampling rate is low; beat timing may be unreliable.'); score -= 20; }
  if (clippedFraction > 0.15) { flags.push('A large fraction of pixels is saturated or very dark. Adjust fingertip pressure or lighting.'); score -= 25; }
  if (jitter > 0.25) { flags.push('Camera frame timing is irregular.'); score -= 10; }
  if (peakIndices.length < 8 || !bpm) { flags.push('Not enough consistent pulse peaks were detected.'); score -= 30; }
  if (validIntervals < 0.75 && candidateIbis.length >= 4) { flags.push('Pulse intervals are inconsistent; motion or signal noise may be present.'); score -= 15; }
  if (pulseStd < 0.00005) { flags.push('Pulse-related variation is very weak. Check that the fingertip fully covers the camera and flash.'); score -= 20; }
  if (!flags.length) flags.push('No major automated signal-quality warning was detected. This does not establish medical validity.');
  score = clamp(score, 0, 100);
  const quality = score >= 75 ? 'good' : score >= 50 ? 'usable_with_caution' : 'poor';
  return {
    bpm: bpm && bpm >= 40 && bpm <= 180 ? bpm : null,
    meanIbiMs, ibiMs, pulseAmplitudeCvPct, relativePulseAmplitudePct,
    samplingRateHz: fs, durationSec, sampleCount: ordered.length,
    qualityScore: score, quality, flags, filtered,
    filteredTimesSec: uniform.times,
    rawRed: ordered.map((s) => s.r),
    rawGreen: ordered.map((s) => s.g),
    rawBlue: ordered.map((s) => s.b),
    rawClipped: ordered.map((s) => s.clippedFraction),
    rawSpatialStd: ordered.map((s) => s.spatialStd),
    rawTimesSec: ordered.map((s) => (s.t - ordered[0].t) / 1000),
    peakIndices, meanRed, clippedFraction,
  };
}

export function makeSyntheticPpg(durationSec = 32, bpm = 76, fs = 30) {
  const samples = [];
  const start = performance.now();
  const count = Math.floor(durationSec * fs);
  for (let i = 0; i < count; i += 1) {
    const t = i / fs;
    const frequency = bpm / 60;
    const fundamental = 3.0 * Math.sin(2 * Math.PI * frequency * t);
    const harmonic = 0.35 * Math.sin(2 * Math.PI * 2 * frequency * t - 0.7);
    const drift = 1.2 * Math.sin(2 * Math.PI * 0.08 * t);
    const noise = 0.18 * (Math.sin(i * 2.31) + 0.4 * Math.sin(i * 0.73));
    const r = 145 + fundamental + harmonic + drift + noise;
    samples.push({ t: start + t * 1000, r, g: r * 0.85, b: r * 0.72, clippedFraction: 0, spatialStd: 2 });
  }
  return samples;
}
