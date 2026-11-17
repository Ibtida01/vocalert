# Changelog

## 0.2.0 — frame-timed capture and pulse-estimator revision

- Prefer `HTMLVideoElement.requestVideoFrameCallback()` and record browser `mediaTime` and `presentedFrames` metadata.
- Use a `video.currentTime`-aware animation-frame fallback only when video-frame callbacks are unavailable.
- Preserve callback timestamps alongside media timestamps in CSV exports.
- Separate effective captured samples/second, median-interval rate, and fixed 30 Hz analysis grid.
- Detect downward-going troughs in the transmission-mode red-channel signal.
- Cross-check trough interval estimates with autocorrelation; withhold rate estimates when the two disagree substantially.
- Add reported presented-frame drop fraction and more conservative quality categories.
- Stop treating repeated RGB region means as evidence that the same frame was sampled.
- Bump local-storage keys to v2 to avoid mixing v0.1 measurement summaries into new baselines.
- Add a device-review note documenting the first Redmi Note 11 Pro+ 5G recordings and their limitations.

All signal-quality thresholds and pulse estimates remain exploratory. This release does not diagnose disease or predict vaso-occlusive crises.
