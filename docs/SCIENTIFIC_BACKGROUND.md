# Scientific background and the boundary of the hypothesis

## 1. What smartphone fingertip PPG measures

Photoplethysmography (PPG) is an optical method that detects changes in light intensity associated with changes in blood volume in superficial tissue. In the fingertip-camera configuration, the phone's rear camera records video while the adjacent flash illuminates the finger. A color-channel intensity trace can be extracted from each frame. This trace contains a pulsatile component related to the cardiac cycle plus slower baseline changes, motion, camera auto-exposure, sensor noise, and contact artifacts.

A smartphone camera can be used to estimate pulse rate under controlled conditions. A 2017 validation study compared fingertip and facial smartphone PPG with ECG during rest and post-exercise measurements in 40 healthy adults. It used approximately 20-second fingertip recordings and instructed participants to minimize movement. The paper supports feasibility of pulse-rate capture; it does not validate VOC prediction.

Reference: https://mhealth.jmir.org/2017/3/e33/  
PubMed: https://pubmed.ncbi.nlm.nih.gov/28288955/

A 2025 smartphone health-monitoring study from India also describes recording 40-second fingertip videos, extracting RGB-channel PPG, and rejecting recordings where camera/finger contact quality was poor.

Reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC11844976/

## 2. Why sickle-cell disease is an interesting research context

Sickle-cell disease (SCD) can involve vaso-occlusive crises (VOCs), which are painful events associated with microvascular obstruction and altered blood flow. Peripheral vasoconstriction and autonomic vasoreactivity are plausible physiological processes to study, but a plausible mechanism is not yet a validated predictor.

A 2026 feasibility and validation study investigated longitudinal nocturnal wearable wristband PPG in 12 people with SCD and 6 healthy controls. It reports 131 nocturnal wristband PPG recordings. The authors derived vasoconstriction-related parameters including magnitude of vasoconstriction (Mvasoc) and PPG amplitude coefficient of variation (PPGampCV). The paper reports within-device associations and cross-device comparisons with a standardized fingertip PPG sensor. The authors describe the work as enabling further development of candidate biomarkers and call for larger/longer studies.

Reference: https://humanfactors.jmir.org/2026/1/e75465/  
DOI: https://doi.org/10.2196/75465

**What that paper does not establish:** It does not establish that a single 30-second smartphone fingertip capture predicts an imminent VOC. The wristband study's longitudinal overnight protocol and its signal-processing definitions differ from this prototype's short camera-based spot measurement. The reported associations are not a clinically validated risk score, and should not be marketed as one.

## 3. Why this prototype starts with measurement, not crisis classification

To train and test a VOC prediction model responsibly, we would need synchronized data containing at least:

- PPG waveforms (preferably reference-grade continuous/overnight sensor data plus smartphone recordings for device-bridging);
- precise timestamps and a pre-specified definition of pain/VOC events, ideally clinically adjudicated;
- event-free observation periods;
- patient-level context and major confounders (medications, temperature, activity, sleep, illness, hydration where clinically appropriate, and device/measurement conditions);
- enough participants and events for participant-independent and temporal validation.

The existing 2026 SCD study is a valuable feasibility signal but is not by itself a sufficiently large labeled dataset for a robust predictive model. The M3PD smartphone PPG dataset can help prototype signal extraction and compare smartphone-derived pulse features with reference physiology, but it is not an SCD/VOC dataset.

M3PD paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC11844976/ (see paper/data links; verify the repository and licence before reuse).

## 4. What the app's displayed features mean

- **Filtered waveform:** the red-channel mean trace after basic band-pass filtering (0.5–4 Hz). It is not a clinically standardized waveform.
- **Pulse-rate estimate:** calculated from detected peaks. It is not ECG and can be wrong when the signal is noisy or irregular.
- **Inter-beat intervals:** time between detected PPG peaks. These are pulse-to-pulse intervals, not ECG R–R intervals.
- **Relative pulse amplitude:** a short-clip AC-like pulse amplitude divided by mean red-channel intensity. It is highly dependent on device optics, exposure, flash output, finger pressure, temperature, and contact.
- **Pulse-amplitude CV:** coefficient of variation of amplitudes estimated between adjacent detected peaks/troughs in this 30-second clip. It is an exploratory feature. It must not be labelled as the study's overnight PPGampCV or treated as a validated vasoconstriction biomarker.
- **Quality score:** a software heuristic to flag obviously weak recordings. It has not been validated against clinician judgement, ECG, or reference PPG.

The app deliberately does not estimate SpO₂, blood pressure, vascular obstruction, or VOC probability.

## 5. What would count as a real contribution?

The first defensible contribution is a characterized low-cost acquisition method: identify supported devices, quantify frame rate and signal failure, compare with reference measurements, and determine whether repeatable waveform features can be recovered from phone-camera fingertip PPG.

A later clinical contribution would test whether those features are associated with subsequent pain outcomes in a prospective SCD cohort. Association, discrimination, calibration, and clinical utility are different claims and must be evaluated separately.
