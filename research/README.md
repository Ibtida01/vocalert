# Offline inspection of VOCALERT CSV exports

This helper is an independent exploratory check for a CSV exported by **Export raw signal CSV** in VOCALERT.

## Setup (Windows PowerShell)

From this `research` folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python .\ppg_inspect.py ..\vocalert-ppg-YYYY-MM-DDTHH-MM-SS.sssZ.csv
```

The script prints a simple pulse-rate estimate from the exported filtered waveform, writes a PNG plot next to the CSV, and produces a JSON summary. Its peak detector is separate from the browser implementation to help catch implementation errors.

By default, the script **refuses synthetic exports**. For software debugging only, use:

```powershell
python .\ppg_inspect.py .\synthetic-export.csv --allow-simulation
```

Do not use synthetic signals in human-subject research, model training, or clinical performance claims.

## Important

This script is not a medical algorithm. Its output is only an engineering cross-check. Compare camera-derived pulse rates with synchronized ECG/reference measurements in an appropriately approved study before reporting measurement accuracy.
