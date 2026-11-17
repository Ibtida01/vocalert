const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mean = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : NaN;

const median = (values) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const std = (values) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

function biquad(input, fs, cutoff, type) {
  const omega = 2 * Math.PI * cutoff / fs;
  const cosine = Math.cos(omega);
  const sine = Math.sin(omega);
  const alpha = sine / (2 * Math.SQRT1_2);
  let b0; let b1; let b2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosine;
  const a2 = 1 - alpha;

  if (type === 'lowpass') {
    b0 = (1 - cosine) / 2;
    b1 = 1 - cosine;
    b2 = (1 - cosine) / 2;
  } else {
    b0 = (1 + cosine) / 2;
    b1 = -(1 + cosine);
    b2 = (1 + cosine) / 2;
  }

  b0 /= a0; b1 /= a0; b2 /= a0;
  const normalizedA1 = a1 / a0;
  const normalizedA2 = a2 / a0;
  const output = new Array(input.length).fill(0);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;

  for (let index = 0; index < input.length; index += 1) {
    const x0 = input[index];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2
      - normalizedA1 * y1 - normalizedA2 * y2;
    output[index] = Number.isFinite(y0) ? y0 : 0;
    x2 = x1; x1 = x0; y2 = y1; y1 = output[index];
  }
  return output;
}

function resampleUniform(samples, fs, channel = 'r') {
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const duration = (end - start) / 1000;
  const count = Math.floor(duration * fs) + 1;
  const values = [];
  const times = [];
  let rightIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const targetMs = start + (index * 1000) / fs;
    while (rightIndex < samples.length - 2 && samples[rightIndex + 1].t < targetMs) {
      rightIndex += 1;
    }
    const left = samples[rightIndex];
    const right = samples[Math.min(rightIndex + 1, samples.length - 1)];
    const span = right.t - left.t;
    const fraction = span > 0 ? clamp((targetMs - left.t) / span, 0, 1) : 0;
    values.push(left[channel] + (right[channel] - left[channel]) * fraction);
    times.push(index / fs);
  }
  return { values, times };
}

function detectTroughs(signal, fs) {
  const signalMedian = median(signal);
  const signalStd = std(signal);
  if (!Number.isFinite(signalStd) || signalStd < 1e-7) return [];

  const minimumDistance = Math.max(1, Math.floor(fs * 60 / 190));
  const prominenceWindow = Math.max(minimumDistance + 1, Math.round(fs * 0.48));
  const minimumProminence = Math.max(signalStd * 0.42, 1e-7);
  const threshold = signalMedian - signalStd * 0.12;
  const candidates = [];

  for (let index = 1; index < signal.length - 1; index += 1) {
    const value = signal[index];
    if (!(value < signal[index - 1] && value <= signal[index + 1] && value < threshold)) continue;

    let leftMaximum = -Infinity;
    let rightMaximum = -Infinity;
    const leftEdge = Math.max(0, index - prominenceWindow);
    const rightEdge = Math.min(signal.length - 1, index + prominenceWindow);
    for (let cursor = leftEdge; cursor < index; cursor += 1) leftMaximum = Math.max(leftMaximum, signal[cursor]);
    for (let cursor = index + 1; cursor <= rightEdge; cursor += 1) rightMaximum = Math.max(rightMaximum, signal[cursor]);
    const prominence = Math.min(leftMaximum - value, rightMaximum - value);
    if (prominence >= minimumProminence) candidates.push({ index, value, prominence });
  }

  // Keep the strongest trough in each refractory window, then restore time order.
  const selected = [];
  for (const candidate of [...candidates].sort((a, b) => a.value - b.value)) {
    if (selected.every((other) => Math.abs(other.index - candidate.index) >= minimumDistance)) {
      selected.push(candidate);
    }
  }
  return selected.sort((a, b) => a.index - b.index).map((candidate) => candidate.index);
}

function estimateFromAutocorrelation(signal, fs) {
  if (signal.length < fs * 5) return { bpm: null, correlation: null };
  const centered = signal.map((value) => value - mean(signal));
  const minimumLag = Math.max(2, Math.round(fs * 60 / 180));
  const maximumLag = Math.min(Math.floor(fs * 60 / 40), Math.floor(centered.length / 3));
  if (maximumLag <= minimumLag) return { bpm: null, correlation: null };

  const correlations = new Map();
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let covariance = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = 0; index < centered.length - lag; index += 1) {
      const left = centered[index];
      const right = centered[index + lag];
      covariance += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    correlations.set(lag, denominator > 0 ? covariance / denominator : -1);
  }

  let globalBestLag = minimumLag;
  let bestCorrelation = -Infinity;
  for (const [lag, correlation] of correlations) {
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      globalBestLag = lag;
    }
  }

  // Prefer the earliest strong positive local maximum. A pulse waveform can
  // produce a stronger autocorrelation at a multiple of its true period; taking
  // the absolute global maximum can therefore halve the estimated heart rate.
  let bestLag = globalBestLag;
  const acceptableCorrelation = bestCorrelation * 0.90;
  for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
    const previous = correlations.get(lag - 1);
    const current = correlations.get(lag);
    const next = correlations.get(lag + 1);
    if (current >= acceptableCorrelation && current > previous && current >= next) {
      bestLag = lag;
      break;
    }
  }
  bestCorrelation = correlations.get(bestLag);

  // Parabolic interpolation improves the lag estimate by a fraction of a sample.
  const previous = correlations.get(bestLag - 1);
  const current = correlations.get(bestLag);
  const next = correlations.get(bestLag + 1);
  let adjustedLag = bestLag;
  if (Number.isFinite(previous) && Number.isFinite(next)) {
    const denominator = previous - 2 * current + next;
    if (Math.abs(denominator) > 1e-9) {
      const offset = 0.5 * (previous - next) / denominator;
      adjustedLag += clamp(offset, -0.5, 0.5);
    }
  }

  const bpm = 60 * fs / adjustedLag;
  return {
    bpm: bpm >= 40 && bpm <= 180 ? bpm : null,
    correlation: bestCorrelation,
    lagSamples: adjustedLag,
  };
}

function robustIntervals(troughIndices, fs) {
  const allIntervals = troughIndices.slice(1).map((index, position) => (
    (index - troughIndices[position]) / fs * 1000
  ));
  const physiological = allIntervals.filter((value) => value >= 333 && value <= 1500);
  if (physiological.length < 2) {
    return { intervals: physiological, allIntervals, validFraction: allIntervals.length ? physiological.length / allIntervals.length : 0 };
  }
  const middle = median(physiological);
  // Exclude obvious false secondary detections and missed-beat multiples from the
  // summary estimate; preserve all intervals in the export for auditability.
  const intervals = physiological.filter((value) => value >= middle * 0.68 && value <= middle * 1.38);
  return {
    intervals,
    allIntervals,
    validFraction: allIntervals.length ? intervals.length / allIntervals.length : 0,
  };
}

export function analyzePpg(samples) {
  const orderedInput = samples
    .filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.r))
    .sort((a, b) => a.t - b.t);

  // A timestamp can be repeated by a fallback capture loop; keep only one sample
  // at each timestamp, without treating identical RGB means as duplicate frames.
  const ordered = [];
  for (const sample of orderedInput) {
    if (!ordered.length || sample.t > ordered[ordered.length - 1].t) ordered.push(sample);
  }

  const durationSec = ordered.length > 1
    ? (ordered[ordered.length - 1].t - ordered[0].t) / 1000
    : 0;
  const intervalsMs = ordered.slice(1).map((sample, index) => sample.t - ordered[index].t).filter((value) => value > 0);
  const medianIntervalMs = median(intervalsMs);
  const meanIntervalMs = mean(intervalsMs);
  const effectiveSamplingRateHz = durationSec > 0 ? (ordered.length - 1) / durationSec : 0;
  const medianIntervalRateHz = Number.isFinite(medianIntervalMs) && medianIntervalMs > 0
    ? 1000 / medianIntervalMs
    : 0;
  const frameIntervalCvPct = Number.isFinite(meanIntervalMs) && meanIntervalMs > 0
    ? (std(intervalsMs) / meanIntervalMs) * 100
    : null;
  const presentedFrameCounts = ordered.map((sample) => sample.presentedFrames).filter(Number.isFinite);
  let presentedFrameDropFraction = null;
  if (presentedFrameCounts.length >= 2) {
    const totalExpected = presentedFrameCounts[presentedFrameCounts.length - 1] - presentedFrameCounts[0];
    let skipped = 0;
    for (let index = 1; index < presentedFrameCounts.length; index += 1) {
      skipped += Math.max(0, presentedFrameCounts[index] - presentedFrameCounts[index - 1] - 1);
    }
    presentedFrameDropFraction = totalExpected > 0 ? skipped / totalExpected : 0;
  }

  // The analysis is deliberately resampled to a known 30 Hz grid. The exported
  // capture timestamps remain untouched and are the source of sampling metadata.
  const analysisFs = 30;
  const uniform = ordered.length >= 3 && durationSec > 5
    ? resampleUniform(ordered, analysisFs, 'r')
    : { values: [], times: [] };
  const meanRed = mean(ordered.map((sample) => sample.r));
  const centered = uniform.values.map((value) => value - mean(uniform.values));
  let filtered = centered;
  if (centered.length > analysisFs * 5) {
    filtered = biquad(filtered, analysisFs, 0.5, 'highpass');
    filtered = biquad(filtered, analysisFs, 4, 'lowpass');
  }

  const trimSamples = Math.min(Math.max(0, filtered.length - 1), Math.round(analysisFs * 1.5));
  const detectionSignal = filtered.slice(trimSamples);
  const troughIndicesLocal = detectTroughs(detectionSignal, analysisFs);
  const troughIndices = troughIndicesLocal.map((index) => index + trimSamples);
  const intervalResult = robustIntervals(troughIndices, analysisFs);
  const ibiMs = intervalResult.intervals;
  const bpmFromTroughs = ibiMs.length >= 2 ? 60000 / median(ibiMs) : null;
  const autocorrelation = estimateFromAutocorrelation(detectionSignal, analysisFs);

  let bpm = null;
  let bpmDisagreement = null;
  if (bpmFromTroughs != null && autocorrelation.bpm != null) {
    bpmDisagreement = Math.abs(bpmFromTroughs - autocorrelation.bpm);
    if (bpmDisagreement <= 12) bpm = median([bpmFromTroughs, autocorrelation.bpm]);
  } else {
    bpm = bpmFromTroughs ?? autocorrelation.bpm;
  }

  const pulseAmplitudes = [];
  for (let position = 0; position < troughIndices.length - 1; position += 1) {
    const start = troughIndices[position];
    const end = troughIndices[position + 1];
    if (end - start < 3) continue;
    let systolicMaximum = -Infinity;
    for (let index = start + 1; index < end; index += 1) systolicMaximum = Math.max(systolicMaximum, filtered[index]);
    const amplitude = systolicMaximum - ((filtered[start] + filtered[end]) / 2);
    if (amplitude > 0) pulseAmplitudes.push(amplitude);
  }

  const amplitudeMean = mean(pulseAmplitudes);
  const pulseAmplitudeCvPct = pulseAmplitudes.length >= 3 && amplitudeMean > 0
    ? (std(pulseAmplitudes) / amplitudeMean) * 100
    : null;
  const relativePulseAmplitudePct = meanRed > 0 && amplitudeMean > 0
    ? (amplitudeMean / meanRed) * 100
    : null;
  const clippedFraction = mean(ordered.map((sample) => sample.clippedFraction));
  const peakCount = troughIndices.length;
  const flags = [];
  let score = 100;

  if (durationSec < 25) { flags.push('Recording is shorter than 25 seconds.'); score -= 25; }
  if (effectiveSamplingRateHz < 20) {
    flags.push('Too few unique timestamped samples were captured for this analysis.');
    score -= 25;
  }
  if (frameIntervalCvPct != null && frameIntervalCvPct > 65) {
    flags.push('Video-frame timing is highly irregular; repeat the capture after updating the app.');
    score -= 25;
  } else if (frameIntervalCvPct != null && frameIntervalCvPct > 40) {
    flags.push('Video-frame timing is variable; interpret timing features cautiously.');
    score -= 12;
  }
  if (presentedFrameDropFraction != null && presentedFrameDropFraction > 0.10) {
    flags.push('The browser reports skipped camera frames; timing features may be less reliable.');
    score -= presentedFrameDropFraction > 0.25 ? 20 : 10;
  }
  if (clippedFraction > 0.15) {
    flags.push('Many pixels are saturated or very dark. Adjust fingertip placement and pressure.');
    score -= 25;
  }
  if (peakCount < 8 || bpm == null) {
    flags.push('Pulse events were not detected consistently enough for a rate estimate.');
    score -= 30;
  }
  if (bpmDisagreement != null && bpmDisagreement > 6) {
    flags.push('Trough timing and autocorrelation estimates differ; pulse rate is uncertain.');
    score -= 15;
  }
  if (intervalResult.validFraction < 0.75 && intervalResult.allIntervals.length >= 4) {
    flags.push('Several detected intervals are inconsistent with the main pulse rhythm.');
    score -= 15;
  }
  if (std(filtered) < 0.00005) {
    flags.push('Pulse-related variation is very weak. Check fingertip coverage and flash.');
    score -= 20;
  }
  score = clamp(score, 0, 100);
  const quality = score >= 85 ? 'good' : score >= 60 ? 'usable_with_caution' : 'poor';
  if (!flags.length) flags.push('No major automated signal warning was detected. This does not establish medical validity.');

  return {
    bpm: bpm != null && bpm >= 40 && bpm <= 180 ? bpm : null,
    bpmFromTroughs,
    bpmFromAutocorrelation: autocorrelation.bpm,
    bpmDisagreement,
    autocorrelationStrength: autocorrelation.correlation,
    meanIbiMs: ibiMs.length ? mean(ibiMs) : null,
    ibiMs,
    allDetectedIntervalsMs: intervalResult.allIntervals,
    pulseAmplitudeCvPct,
    relativePulseAmplitudePct,
    samplingRateHz: effectiveSamplingRateHz,
    medianIntervalRateHz,
    effectiveSamplingRateHz,
    frameIntervalCvPct,
    presentedFrameDropFraction,
    analysisSamplingRateHz: analysisFs,
    durationSec,
    sampleCount: ordered.length,
    peakCount,
    qualityScore: score,
    quality,
    flags,
    filtered,
    filteredTimesSec: uniform.times,
    rawRed: ordered.map((sample) => sample.r),
    rawGreen: ordered.map((sample) => sample.g),
    rawBlue: ordered.map((sample) => sample.b),
    rawClipped: ordered.map((sample) => sample.clippedFraction),
    rawSpatialStd: ordered.map((sample) => sample.spatialStd),
    rawTimesSec: ordered.map((sample) => (sample.t - ordered[0].t) / 1000),
    peakIndices: troughIndices,
    meanRed,
    clippedFraction,
    pulsePolarity: 'downward_red_troughs',
  };
}

export function makeSyntheticPpg(durationSec = 32, bpm = 76, fs = 30) {
  const samples = [];
  const start = performance.now();
  const count = Math.floor(durationSec * fs);
  for (let index = 0; index < count; index += 1) {
    const time = index / fs;
    const frequency = bpm / 60;
    // A downward-going red-channel pulse approximates transmission-mode fingertip PPG.
    const phase = (time * frequency) % 1;
    const pulse = Math.exp(-(((phase - 0.12) / 0.055) ** 2));
    const recovery = 0.16 * Math.exp(-(((phase - 0.38) / 0.10) ** 2));
    const drift = 1.2 * Math.sin(2 * Math.PI * 0.08 * time);
    const noise = 0.10 * (Math.sin(index * 2.31) + 0.4 * Math.sin(index * 0.73));
    const red = 220 + drift - 3.2 * pulse + recovery + noise;
    samples.push({
      t: start + time * 1000,
      r: red,
      g: red * 0.17,
      b: red * 0.37,
      clippedFraction: 0,
      spatialStd: 2,
      mediaTimeSec: time,
      presentedFrames: index + 1,
    });
  }
  return samples;
}
