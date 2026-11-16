# VOCALERT — 3-minute demo script

## One-sentence pitch

“VOCALERT is a local-first smartphone PPG research tool that makes fingertip pulse-signal capture and quality assessment accessible, as the first engineering step toward studying personalized peripheral vascular changes in sickle-cell disease.”

## Demo sequence

### 0:00–0:25 — Explain the clinical motivation

“Sickle-cell vaso-occlusive crises are painful and can be difficult to anticipate. A 2026 feasibility study explored longitudinal wearable PPG markers of peripheral vasoreactivity in a very small SCD cohort. It did not establish a clinically validated crisis predictor. We are not claiming to have solved that problem; we are building and validating the measurement pathway first.”

### 0:25–1:20 — Live phone capture

1. Open the deployed HTTPS app on Android Chrome.
2. Select Measure PPG and enable the camera.
3. Show the torch/camera status and fingertip placement instructions.
4. Start the 35-second capture (5-second warm-up + 30-second sample).
5. Keep the finger still and lightly placed.

If the live capture is not reliable in the room, switch to the clearly labelled simulated waveform. Never present synthetic signal as a participant result.

### 1:20–2:10 — Explain the analysis

Show the filtered waveform, pulse-rate estimate, quality warnings, and experimental amplitude features. Explain that the quality score checks the recording, not the participant's health. Show CSV export and local-only baseline storage.

### 2:10–2:45 — Show the research plan

“First we compare smartphone pulse-rate estimates against synchronized reference measurements. Next we test repeatability of amplitude-derived features. Only after that, with ethics approval and a hematology partner, we will test whether longitudinal reference PPG changes are associated with subsequent clinically documented pain events.”

### 2:45–3:00 — Responsible AI

“No crisis score is shown. No medical diagnosis is made. Data stays in the browser unless explicitly exported. Our next milestone is measurement validation, not a claim of clinical prediction.”

## Demo checklist

- Test the same phone and browser before presenting.
- Ensure the deployed URL is HTTPS.
- Grant camera permission ahead of time.
- Check whether torch activates.
- Disable battery saver if it throttles camera capture.
- Have the synthetic demo ready as a fallback and label it clearly.
- Have one exported CSV ready only if it came from an actual consented/approved test; otherwise show a synthetic sample clearly labelled as synthetic.
- Never use another person's medical data without permission and an approved protocol.
