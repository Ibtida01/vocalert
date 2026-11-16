# Future AI model roadmap — only after signal and outcome data exist

## Why no trained VOC model is shipped

The app's intended future target would be a clinically defined event in a fixed future horizon, but this repository contains no paired smartphone PPG recordings and timestamped SCD pain/VOC outcomes. A model trained on synthetic waveforms, generic healthy-user PPG, or blood-smear images would not answer that question. Therefore there is deliberately no fake “VOC probability” model.

## Recommended order of modelling

### 1. Establish a non-ML reference

Build a reproducible signal pipeline and simple summaries. Compare against reference pulse measurements. If the phone cannot reliably capture the signal, a more complex model will not fix the acquisition problem.

### 2. Establish repeatability

Use repeated recordings and mixed-effects/reliability analysis to determine which features are stable enough to study. Consider pulse rate, pulse-to-pulse intervals, normalized pulse amplitude, pulse-amplitude variability, and signal quality. Freeze the feature definitions before examining VOC outcomes where possible.

### 3. Define the target with clinicians

A possible future target is “clinically adjudicated VOC/pain event within the next pre-specified 12 or 24 hours.” This is only an example. Hematologists, patients, and biostatisticians must choose and operationalize the event definition and time horizon. Define what counts as an event, how pain reports are time-stamped, and what periods are truly event-free.

### 4. Build simple, interpretable baselines first

Depending on the data structure and event count:

- logistic regression for a fixed-horizon event/no-event question;
- discrete-time survival or landmark models for time-to-event;
- mixed-effects models for within-person feature trajectories;
- penalized models to reduce overfitting when events are limited.

Only then compare tree-based models (e.g., CatBoost/LightGBM) or sequence models if the participant and event counts justify them. Deep learning is not automatically better for a small cohort.

### 5. Prevent leakage

- Split by participant, not by recording window.
- Use temporal holdout and, ideally, an external clinical site.
- Fit normalization and feature selection on training data only.
- Ensure a predictor window ends before the event window begins.
- Remove post-event measurements and variables that are part of the outcome definition.
- Do not use an individual’s future information to normalize their past data.

### 6. Evaluate clinically meaningful performance

Report, with confidence intervals:

- AUROC and especially AUPRC when events are rare;
- sensitivity and specificity at pre-specified operating points;
- calibration plots, Brier score, and calibration slope/intercept;
- positive and negative predictive values at the cohort prevalence;
- event-based lead time;
- false alerts per patient-day/week;
- proportion of time the model abstains because data are missing or poor quality;
- subgroup and device/site performance;
- decision-curve or clinical-utility analysis when appropriate.

Accuracy alone is not adequate. A model can achieve high accuracy by predicting “no event” most of the time.

## Suggested future data table

A future clinical data table should be event-centred and timestamped. Example fields (final schema must be approved by the research team):

```text
participant_code
recording_id
recording_start_utc
recording_end_utc
sensor_type                 # phone-camera / wrist wearable / reference finger PPG
phone_or_sensor_model
sample_rate_hz
signal_quality
heart_rate_bpm
pulse_amplitude_normalized
pulse_amplitude_cv
activity_context
sleep_context
ambient_temperature
hand_or_sensor_temperature_if_available
medication_context_as_approved
pain_score_timestamped
clinician_adjudicated_voc_start
clinician_adjudicated_voc_end
followup_status
```

Do not collect fields without a scientific rationale, and do not store direct identifiers in the analysis file. The participant-to-identity key must be held separately by the clinical institution.

## Model development stop rule

If smartphone features are not repeatable, if they do not agree adequately with reference PPG, or if the clinical dataset has too few accurately timestamped events, stop or redesign the VOC prediction study. Do not lower the validation bar simply to retain the original idea.
