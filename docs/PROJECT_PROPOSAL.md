# VOCALERT — project and research proposal

## Working title

**VOCALERT: A Local-First Smartphone PPG Acquisition and Personalized Vascular-Signal Research Platform for Sickle-Cell Disease**

## 150-word abstract

Vaso-occlusive crises (VOCs) are a major source of pain and acute-care use in sickle-cell disease (SCD), yet an accessible, validated physiological early-warning method is not established. Recent feasibility work has explored longitudinal wearable photoplethysmography (PPG) markers of peripheral vasoreactivity in people with SCD. VOCALERT addresses an earlier engineering gap: whether a standard smartphone rear camera and flash can capture sufficiently repeatable fingertip PPG features for longitudinal research. The current prototype performs local browser-based acquisition, frame-quality checks, signal filtering, pulse-interval estimation, exploratory pulse-amplitude characterization, personal-reference comparison, and export. It deliberately makes no SCD diagnosis or VOC prediction. The first research stage will characterize smartphone signal feasibility and agreement with synchronized reference measurements; a later ethics-approved prospective SCD study will test whether within-person feature changes associate with clinically documented subsequent pain events. The intended contribution is a reproducible, accessible measurement pathway—not an unvalidated crisis alert.

## Problem statement

A recent small SCD feasibility study has explored wearable nocturnal PPG and vasoconstriction-related measurements. Its findings are preliminary and do not validate a brief smartphone spot-check as a VOC predictor. A lower-cost camera-based acquisition pathway could make repeat measurements easier to collect, but optical, motion, pressure, temperature, device, and sampling limitations must be characterized first.

## Central hypothesis

After technical validation, within-person changes in standardized smartphone-derived fingertip PPG features may provide a repeatable proxy for selected aspects of peripheral pulse-wave variation. Whether such changes are associated with subsequent VOC/pain events is an open clinical research question that requires prospective SCD data.

## Specific aims

### Aim 1 — Smartphone acquisition feasibility

Develop and characterize a standardized rear-camera + flash fingertip PPG capture protocol across selected Android devices. Quantify frame rate, signal failure, pulse-rate agreement with synchronized reference measurements, and usability.

### Aim 2 — Feature repeatability

Measure within-session and between-day repeatability of camera-derived pulse amplitude and pulse-amplitude variability. Quantify the sensitivity of each feature to placement, pressure, temperature, posture, phone model, and ambient conditions.

### Aim 3 — Clinical association (future work)

In a prospective, ethics-approved SCD cohort, evaluate whether reference PPG and smartphone-derived within-person changes are associated with clinically adjudicated pain/VOC events within a pre-specified time horizon. The study must be designed with hematologists and biostatisticians.

## Why a smartphone camera?

It reduces the need for a dedicated sensor during spot-check engineering experiments. It does not provide the same continuous or overnight measurement as a wearable. The research must prove that the shorter camera-based protocol can capture useful and repeatable features before a clinical prediction task is attempted.

## What is novel—and what is not

**Not novel:** using a smartphone camera + flash to estimate pulse rate. This has been demonstrated in prior research.

**Potentially differentiating contribution:** a carefully standardized, quality-gated, local-first capture and repeatability protocol designed as a bridge toward longitudinal SCD PPG research, with explicit comparison to reference signals and device/condition robustness analysis.

**Not yet established:** that a 30-second smartphone PPG amplitude feature predicts VOC. No model or result in this codebase supports this claim.

## Prototype features

- Rear camera and best-effort torch access.
- 5-second warm-up, 30-second recording.
- RGB average extraction from a fixed central ROI.
- Red-channel detrending and 0.5–4 Hz filtering.
- Basic peak detection and pulse-rate estimate.
- Exploratory pulse-amplitude features.
- Heuristic signal quality flags and abstention-like “repeat recording” guidance.
- Local-only summaries and personal reference; CSV/JSON export.
- Synthetic demo clearly marked as non-human data.

## Evaluation plan

1. Software correctness tests using synthetic waveforms at several known rates.
2. Device feasibility: frame rate, torch behavior, saturation, usable recording percentage.
3. Reference agreement: synchronized ECG preferred for beat timing; a validated pulse monitor may be used for pulse-rate comparison but not as an ECG substitute for beat-to-beat analysis.
4. Repeatability: repeated resting recordings, multiple days and devices.
5. SCD prospective study: participant-level and temporal validation; calibration and false-alert burden; external site validation.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Phone camera auto-exposure and white-balance changes | Characterize device settings; record raw RGB and camera metadata where available; reject unstable captures |
| Torch not exposed in browser | Device compatibility testing; native app only if web limitation blocks the study |
| Finger pressure changes local perfusion | Standardized light-contact instructions and repeatability experiments |
| Short clips differ from overnight wearable PPG | Treat phone and wearable protocols as different measures until bridged empirically |
| Few/poorly timestamped VOC labels | Prospective clinical partnership; pre-specified adjudication and event log |
| Confounding by activity, temperature, medication, sleep, infection, etc. | Pre-specify covariates with clinicians; collect appropriate context |
| False reassurance or alarm | No risk score in prototype; future silent validation before any alert is shown |

## Deliverable boundaries

The present codebase is the engineering prototype for Aim 1. It is not a medical device, an SCD screening tool, a VOC predictor, or a clinically validated decision-support system.
