# VOCALERT — smartphone fingertip PPG research prototype

**Version:** 0.2.0  
**Runs with:** HTML + CSS + JavaScript; no build step, framework, npm package, backend, or external font dependency.  
**Purpose:** capture a short fingertip photoplethysmography (PPG) signal using a smartphone rear camera + flash, inspect signal quality, calculate exploratory pulse features, compare a recording with a locally stored personal resting reference, and export data for research.

> **Critical medical boundary:** VOCALERT is an engineering/research prototype. It does not diagnose sickle-cell disease, measure blood oxygen or blood pressure, diagnose vasoconstriction, predict a vaso-occlusive crisis (VOC), or provide treatment advice. It must not be used to make healthcare decisions or to delay care. The crisis-prediction idea is a research hypothesis only.

## 1. What is implemented

- Rear-camera access through the browser's `getUserMedia` API.
- Best-effort flashlight/torch activation through browser video-track constraints (device and browser support vary).
- Center-region RGB sampling from presented camera frames using `requestVideoFrameCallback` where available; each row includes media-time and presented-frame metadata. A media-time-aware `requestAnimationFrame` fallback is used only when the browser lacks the video-frame callback API.
- Five-second warm-up followed by a 30-second measurement window.
- Uniform resampling to a 30 Hz analysis grid, 0.5–4 Hz filtering, downward red-channel trough detection, autocorrelation cross-check, pulse-rate estimate, inter-beat intervals, relative pulse amplitude, and exploratory beat-to-beat pulse-amplitude coefficient of variation.
- Heuristic recording-quality flags (duration, captured-sample rate, frame-timing variability, pixel clipping, and agreement between trough timing and autocorrelation). These thresholds are **not clinically validated**. Identical RGB averages are not used as proof of duplicate frames.
- Synthetic waveform mode for demonstrating the interface on a desktop without a camera.
- Optional local-only resting-reference entries and measurement summaries in browser `localStorage`.
- CSV export of current RGB samples and filtered signal; JSON export of locally saved summaries.
- Responsive installable PWA shell. Camera use still requires a secure browser context (HTTPS or localhost).

## 2. What changed in v0.2

- Uses `HTMLVideoElement.requestVideoFrameCallback()` where available, recording `mediaTime` and `presentedFrames` metadata.
- Uses a media-time-aware fallback only when that API is unavailable.
- Separates effective captured samples/second from median-interval rate and the 30 Hz analysis grid.
- Uses downward-going red-channel troughs for transmission-mode pulse candidates and cross-checks the interval estimate with autocorrelation.
- Adds a caution band for warning-bearing recordings; a 75/100 recording is no longer labelled “good”.
- Exports both video media time and callback timestamp so frame timing can be audited.
- Uses v2 local-storage keys so v0.1 summaries are not silently mixed into new baselines.

The first three user-supplied recordings from a Redmi Note 11 Pro+ 5G were re-analysed during this revision. The original v0.1 estimates (75, 75, 94.7 BPM) differed from the v0.2 exploratory outputs (approximately 72, 67, 68 BPM). These are not reference-validated heart rates. The old exports did not include browser media-time/presented-frame metadata, so their actual camera frame cadence cannot be established retrospectively. See `docs/REDMI_NOTE11_PRO_PLUS_FIRST_REVIEW.md`.

## 3. What is intentionally not implemented

- No sickle-cell classifier.
- No VOC warning or crisis-risk score.
- No inference of blood oxygen saturation (SpO₂), blood pressure, perfusion status, or vascular disease.
- No medical advice, medication advice, or emergency triage.
- No cloud API, login, analytics, server database, or automatic upload.
- No claim that a 30-second phone recording reproduces overnight wristband/finger-sensor biomarkers from the 2026 SCD feasibility study.

## 4. Run locally on Windows 11

No Node.js or npm installation is needed.

1. Install Python (3.11 or newer) if it is not already installed.
2. Extract the ZIP to a folder, for example `C:\VOCALERT`.
3. Open PowerShell in that folder.
4. Run:

   ```powershell
   py -m http.server 8000
   ```

   If `py` is unavailable, try `python -m http.server 8000`.

5. Open `http://localhost:8000` in Chrome or Edge.
6. Open **Measure PPG → acknowledge the research-only limitation → Try simulated signal** to test the UI and signal pipeline. This works without a camera.

Stop the local server with `Ctrl+C`.

## 5. Use it on your Android smartphone

The browser needs camera access in a secure context. A plain HTTP LAN address (e.g. `http://192.168.x.x:8000`) may not permit camera access.

### Recommended: GitHub Pages (free HTTPS)

1. Create a new GitHub repository, e.g. `vocalert`.
2. Upload the contents of this project folder to the repository root (make sure `index.html`, `app.js`, `signal.js`, and `styles.css` are at the root, not nested in another folder).
3. In GitHub, open **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
5. Wait for GitHub Pages to publish the static site. Its URL will look like `https://YOUR-USERNAME.github.io/vocalert/`.
6. Open that HTTPS URL on your Android phone in current Chrome.
7. Go to **Measure PPG**, tick the research-only acknowledgement, then tap **Enable camera** and allow permission.
8. The app attempts to turn on the torch. If it reports “torch unconfirmed”, the browser/device may not expose torch control. Inspect the preview; do not proceed as if illuminated if the flash is actually off.
9. Follow the fingertip placement instructions and select **Start 35-second capture**.
10. Review the quality warnings. Repeat a poor-quality capture; do not try to “fix” a poor result by pressing harder.
11. Select **Export raw signal CSV** to inspect the recording in Python.

To install the app-like PWA, open the HTTPS site in Chrome and select **⋮ → Add to Home screen** (wording can differ by Android version).

### Alternative static hosting

Netlify Drop, Cloudflare Pages, or Vercel can also host this as a static site. Choose the project directory as the publish/output directory and use **no build command**. The project has no npm dependencies.

## 6. Fingertip placement protocol

1. Sit down and rest quietly for about five minutes before a resting measurement.
2. Ensure the phone camera lens and adjacent flash are clean.
3. Use the soft pad of the index finger. Cover both the rear camera lens and its adjacent flash; do not use the nail.
4. Use light, steady contact. **Do not squeeze or press hard.** Excessive pressure changes local blood flow and can distort the signal.
5. Keep the hand supported and still. Do not speak, walk, or move during the 30-second recording.
6. If your fingers are cold, wait until they are comfortably warm. Do not use extreme heat.
7. A very bright/saturated image, dark image, unstable contact, or poor pulse waveform should be rejected and repeated later under better conditions.
8. Record device model, browser, measurement time, posture, hand/finger, and relevant test conditions in a separate research log. Do not place identifying information into the signal file.

**Never use VOCALERT during a suspected acute medical event to decide whether to seek care.** If someone with sickle-cell disease develops pain or other symptoms covered by their clinical care plan, follow that plan and contact their treating team. Do not wait for this app.

## 7. How to interpret the screen

- **Pulse-rate estimate:** downward-going red-channel trough intervals cross-checked against autocorrelation. This is an exploratory camera-derived pulse estimate, not ECG; if the two methods disagree, the app should withhold or flag the estimate.
- **Signal quality:** heuristic software checks. “Good” means only that the recording passed these checks; it does not mean medically accurate.
- **Relative pulse amplitude:** filtered pulse amplitude divided by mean red-channel intensity. This is sensitive to device optics, exposure, flash output, finger pressure, temperature, fit, and contact.
- **Pulse amplitude CV:** coefficient of variation of amplitudes estimated between adjacent detected peaks/troughs in this 30-second clip. It is experimental. It is **not interchangeable** with the overnight PPG amplitude CV used in the cited sickle-cell study.
- **Baseline comparison:** descriptive differences from readings explicitly saved on this device. It is not a risk score or a normal range. Build a personal reference using repeated, comparable resting sessions on different days.
- **Simulation:** synthetic data generated in JavaScript. It is for testing the UI and analysis path only. It is never a participant recording and must never enter a study dataset.

## 8. Privacy and data handling

- Camera frames are processed in the browser and are not recorded as video or sent to a server.
- Raw per-frame RGB samples remain in memory until the page is refreshed or another capture begins, unless you explicitly export a CSV.
- The app stores only summaries and baseline features when you press the corresponding save buttons. These are stored in this browser's `localStorage`.
- The app has no login, analytics, remote database, or third-party font dependency. The static host receives ordinary page requests when the app is loaded.
- Do not enter names, national IDs, phone numbers, patient identifiers, or other identifying information into the app. Research exports should use study-specific pseudonymous IDs managed separately under an approved protocol.
- Clearing browser data or using a different browser/device may remove or separate local records. Export data you intend to keep.

## 9. Project structure

```text
vocalert/
├── app.js                    # browser UI, camera capture, local storage, exports
├── signal.js                 # PPG resampling, filtering, trough detection, autocorrelation, features
├── styles.css                # responsive interface
├── index.html                # static app shell
├── manifest.webmanifest      # PWA metadata
├── sw.js                     # basic offline shell cache
├── favicon.svg, icon-192.png, icon-512.png
├── .nojekyll                 # GitHub Pages compatibility
├── CHANGELOG.md              # release notes
├── package.json              # only declares native ES-module mode; no dependencies
├── docs/
│   ├── SCIENTIFIC_BACKGROUND.md
│   ├── VALIDATION_PROTOCOL.md
│   ├── ANDROID_PHONE_GUIDE.md
│   ├── HACKATHON_DEMO_SCRIPT.md
│   ├── PROJECT_PROPOSAL.md
│   ├── AI_MODEL_ROADMAP.md
│   └── SESSION_LOG_TEMPLATE.csv
└── research/
    ├── README.md
    ├── ppg_inspect.py
    ├── test_signal.js
    └── requirements.txt
```

## 10. Engineering limitations to test on your phone

- Torch control via `MediaStreamTrack.applyConstraints({ advanced: [{ torch: true }] })` is not universally supported. The app reports if it cannot confirm torch activation.
- Some browsers expose a preview but do not provide a stable camera frame cadence. Check `frame_capture_mode`, `video_media_time_seconds`, `presented_frames`, effective captured samples/second, and quality flags in the export. A repeated RGB region mean is not proof that the exact same camera frame was read twice.
- Camera auto-exposure, white balance, compression, rolling shutter, sensor size, flash characteristics, skin temperature, and finger pressure can change the extracted signal.
- The initial region of interest is a centered crop. Some phone camera layouts may need tuning. `requestVideoFrameCallback` timing is browser-dependent; check the exported media-time sequence on each target device.
- The v0.2 trough detector and autocorrelation cross-check are still exploratory and need comparison against a synchronized reference signal before any research use.
- A single app capture is not a validated physiological measurement.

## 11. Research and scientific limitations

Read these before presenting results:

- `docs/SCIENTIFIC_BACKGROUND.md` explains the 2026 SCD PPG study and why the app is not yet a crisis predictor.
- `docs/VALIDATION_PROTOCOL.md` outlines the engineering, repeatability, prospective-cohort, and silent-validation stages.
- `docs/HACKATHON_DEMO_SCRIPT.md` contains a responsible 3-minute pitch and demo sequence.
- `research/test_signal.js` checks the detector against synthetic pulse rates (run with `node research/test_signal.js` if Node.js is installed); `research/ppg_inspect.py` independently inspects an exported camera CSV and refuses synthetic data unless explicitly overridden. `docs/PROJECT_PROPOSAL.md` summarizes the research aims and differentiation; `docs/AI_MODEL_ROADMAP.md` explains what data are required before training a VOC model.

A custom machine-learning predictor is **not included**. A valid VOC prediction model requires paired longitudinal PPG and event labels from people with SCD. Training a model on unrelated pulse datasets or simulated signals would produce an unsupported claim, so this codebase does not fabricate one.

## Licence / use

Provided as an educational and research prototype. You are responsible for verifying local institutional, ethics, privacy, regulatory, and clinical requirements before collecting human-subject data or making any clinical claim. Do not market the current prototype as a medical device or clinical decision-support product.
