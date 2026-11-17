# VOCALERT validation roadmap

This is a protocol-development document, not ethics approval. Obtain approval from the relevant institutional review board/ethics committee and informed consent before collecting human-subject research data. Work with a clinician/research supervisor, especially for any SCD cohort.

## Stage 0 — Software verification (no human-subject claims)

1. Run the synthetic demo and verify that the chart, metric cards, and exports work.
2. Test camera permission, camera stop/release, torch state, and repeated captures on at least two Android phone models if available.
3. Check exported CSV timestamps, sample count, duration, and source metadata.
4. Confirm that simulated recordings are clearly marked and excluded from any research dataset.
5. Verify that no network request is made by the app during capture. The app is designed to process locally; hosting providers still receive ordinary web requests when the application is loaded.

## Stage 1 — Engineering/measurement feasibility

### Objective

Determine whether smartphone-camera fingertip video can produce a usable pulse waveform and pulse-rate estimate under a standardized spot-check protocol.

### Participants

Start with a small convenience/engineering pilot only after required approval. A pilot can characterize usability and gross signal failure; it cannot establish clinical validity or performance in SCD. Do not advertise a fixed sample size as statistically powered without a calculation based on the primary endpoint and expected variance.

### Acquisition

- Rest seated for 5 minutes before each resting recording.
- Keep the hand supported and comfortably warm.
- Use the fingertip pad to cover camera + flash with light pressure.
- Capture 30–60 seconds per recording (VOCALERT v0.2 uses a 30-second measurement after 5 seconds warm-up).
- Repeat at least 3 recordings per participant with a short rest between recordings.
- Record smartphone model, Android version, browser version, camera resolution, observed frame rate, time, hand/finger, posture, ambient conditions, recent activity, and whether the flash was confirmed on.
- Avoid collecting names, phone numbers, national IDs, or direct identifiers in the signal file.

### Reference measurement

Prefer synchronized ECG for beat timing if available. A clinically validated pulse oximeter can be used for an independent pulse-rate reference, but it is not a substitute for ECG when evaluating beat-to-beat intervals/HRV. Record the exact reference device and its specifications. Synchronization must be documented.

### Primary engineering outcomes

Pre-specify one primary outcome, for example absolute error in pulse rate versus a synchronized reference during stable resting periods. Secondary outcomes can include:

- usable-recording rate;
- failure rate by phone model and capture condition;
- mean absolute error (MAE) and root mean squared error (RMSE);
- Bland–Altman bias and limits of agreement;
- repeatability across repeated recordings (ICC or an appropriate within-subject reliability statistic);
- sensitivity of estimates to movement, finger pressure, hand temperature, and lighting;
- differences in failure/error across relevant skin-tone groups, assessed respectfully and only with consent/appropriate measures.

Correlation alone is not sufficient evidence of agreement. Report confidence intervals and individual-level error distributions, not only an average or a high correlation coefficient.

## Stage 2 — Feature repeatability

Test whether the features VOCALERT derives (relative pulse amplitude and short-clip pulse-amplitude CV) are repeatable within a person. These are not validated SCD biomarkers. Quantify intra-session and inter-day reliability and sensitivity to pressure, temperature, position, exposure, device model, and activity. If the features are not repeatable, do not carry them into the clinical hypothesis.

## Stage 3 — SCD observational cohort (requires clinical partnership)

### Core question

Are within-person changes in standardized PPG features associated with clinically documented subsequent pain/VOC events over a pre-specified time horizon?

### Required data

- Longitudinal PPG from a reference-grade wearable/finger sensor, ideally overnight or continuous as justified by the clinical protocol.
- Smartphone spot recordings to establish whether phone-derived features agree with reference measurements.
- Precise recording timestamps and event timestamps.
- A pre-specified, clinician-agreed pain/VOC event definition and adjudication workflow.
- Event-free periods and sufficient follow-up.
- Clinically appropriate covariates/confounders, pre-specified with the medical team.

### Design safeguards

- Do not recruit or monitor participants without an approved protocol and clinician oversight.
- Do not ask participants to wait for a model alert or alter their treatment based on an experimental reading.
- Keep all care decisions with the clinical team and existing care plan.
- Do not define a VOC using measurements that are also predictors at the same time point (label leakage).
- Split train/validation/test by participant, not by recording window. Consider temporal holdout and external-site validation.
- Pre-register the prediction horizon (e.g., next 12 or 24 hours) and primary outcome before analysis.
- Account for repeated measures and within-person dependence.
- Report calibration, sensitivity, specificity, PPV/NPV at clinically relevant prevalence, event-based lead time, false alerts per patient-day, and decision-curve/clinical utility analysis where appropriate.
- Evaluate subgroup performance and missingness; report uncertainty.
- A retrospective model is not a deployed warning system. Prospective silent validation must precede any intervention study.

## Stage 4 — prospective silent validation

Run the locked model without showing predictions to patients or clinicians. Compare predictions against adjudicated outcomes. Examine calibration drift, false-alert burden, missing data, device failures, and site/device generalization. Only after this stage and further regulatory/clinical review should an interventional clinical utility study be considered.

## Suggested dataset session-log fields

See `SESSION_LOG_TEMPLATE.csv`. Use a study-specific pseudonymous participant code and store the re-identification key separately under the institution's governance. Do not put direct identifiers in exported VOCALERT files.
