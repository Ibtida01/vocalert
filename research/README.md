# Offline inspection of VOCALERT CSV exports

This helper independently inspects a CSV exported by **Export raw signal CSV** in VOCALERT v0.2.

## Setup (Windows PowerShell)

From this `research` folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python .\ppg_inspect.py ..\vocalert-ppg-YYYY-MM-DDTHH-MM-SS.sssZ.csv
```

The script reads the raw red-channel series and timestamps, resamples the trace to a 30 Hz analysis grid, independently filters it, detects downward red-channel troughs, and cross-checks the pulse-rate estimate with autocorrelation. It writes a PNG plot and JSON summary next to the CSV.

It reports effective captured rows/second, median timestamp interval rate, and interval variability separately. Do not interpret the median interval rate as actual camera FPS when timestamp spacing is irregular. For v0.2 exports, inspect `video_media_time_seconds`, `presented_frames`, and `frame_capture_mode` as well.

By default, the script **refuses synthetic exports**. For software debugging only, use:

```powershell
python .\ppg_inspect.py .\synthetic-export.csv --allow-simulation
```

Do not use synthetic signals in human-subject research, model training, or clinical performance claims.

## Important

This script is not a medical algorithm. Its output is only an engineering cross-check. Compare camera-derived pulse rates with synchronized ECG/reference measurements in an appropriately approved study before reporting measurement accuracy. Agreement between the browser and Python tools is not a substitute for an external reference because both process the same camera signal.
