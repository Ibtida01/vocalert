# Redmi Note 11 Pro+ 5G — first v0.1 recording review

**Status:** preliminary engineering review only; not clinical validation.

## Test context

The user reported three approximately 30-second recordings on a Redmi Note 11 Pro+ 5G while seated at rest. The v0.1 application reported 75 BPM, 75 BPM, and 94.7 BPM, with all three marked “good” at 90/100.

## Re-analysis of the supplied CSV exports

The v0.2 signal pipeline was applied offline to the three original RGB time series. It resampled the irregular series to a 30 Hz analysis grid, filtered the red channel in the 0.5–4 Hz band, detected downward-going red-channel troughs, and cross-checked the interval estimate using autocorrelation.

| Recording | v0.1 app BPM | v0.2 exploratory re-analysis |
|---|---:|---:|
| 1 | 75.0 | 72.1 |
| 2 | 75.0 | 67.3 |
| 3 | 94.7 | 67.9 |

These values are algorithm outputs from the same recordings, not reference-validated heart rates. The differences suggest that v0.1's upward-peak detector was vulnerable to secondary waveform features/noise in this transmission-mode red-channel signal. The third recording's 94.7 BPM should not be accepted as a reliable result from the v0.1 pipeline.

## Capture timing limitation in v0.1 exports

The three CSVs contained 1,458–1,512 rows across approximately 30 seconds (about 48.7–50.4 exported rows/second). Their timestamp intervals were highly variable. Their RGB means were identical on about 66–67% of adjacent rows, but identical spatial RGB averages do **not** prove that the same decoded video frame was read repeatedly: two different frames can have identical region averages. The v0.1 export did not include the video media timestamp or presented-frame counter, so the actual presented camera frame cadence cannot be confirmed retrospectively.

The v0.2 capture path therefore uses `requestVideoFrameCallback` when available and exports `mediaTime`, `presentedFrames`, and the callback timestamp. It also reports effective captured samples/second separately from the median-interval rate.

## Known information still missing

- Android OS version and build
- Chrome/browser version
- actual camera-track settings reported by the browser
- whether torch activation was confirmed in the browser
- synchronized independent pulse reference (ECG or validated reference pulse monitor)

## Next test

Use v0.2 on the same phone with the same finger, posture, hand support, and illumination. Export three resting recordings and check that the new CSV contains monotonic `video_media_time_seconds` values and `presented_frames` metadata. Compare pulse estimates against a reference measurement taken as close in time as practical. Do not add these recordings to a personal baseline until the signal-quality flags and reference comparison are satisfactory.

**Boundary:** nothing in this review indicates or assesses sickle-cell disease, vasoconstriction, or an impending vaso-occlusive crisis.
