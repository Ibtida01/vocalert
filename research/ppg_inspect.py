#!/usr/bin/env python3
"""Independent engineering inspection of a VOCALERT exported PPG CSV.

Not a diagnostic tool. Does not estimate VOC risk, SpO2, blood pressure, or HRV.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks


def read_metadata(path: Path) -> dict[str, str]:
    metadata: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if not line.startswith("#"):
                break
            line = line[1:].strip()
            if "=" in line:
                key, value = line.split("=", 1)
                metadata[key.strip()] = value.strip()
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path, help="VOCALERT raw signal CSV export")
    parser.add_argument("--allow-simulation", action="store_true", help="Allow synthetic demo data for software testing only")
    args = parser.parse_args()

    path = args.csv_path.expanduser().resolve()
    if not path.is_file():
        parser.error(f"CSV does not exist: {path}")

    metadata = read_metadata(path)
    source = metadata.get("source", "unknown").lower()
    if source == "simulation" and not args.allow_simulation:
        print("Refusing synthetic signal. Add --allow-simulation for software debugging only.", file=sys.stderr)
        return 2
    if source != "camera" and not (source == "simulation" and args.allow_simulation):
        print(f"Unrecognized source={source!r}. Only camera recordings are accepted by default.", file=sys.stderr)
        return 2

    data = pd.read_csv(path, comment="#")
    required = {"time_seconds", "red_channel_mean", "filtered_red_channel"}
    missing = required.difference(data.columns)
    if missing:
        parser.error(f"Missing required columns: {sorted(missing)}")

    data = data.replace([np.inf, -np.inf], np.nan).dropna(subset=["time_seconds", "filtered_red_channel"])
    if len(data) < 150:
        print(f"Only {len(data)} valid samples: too short for this inspection.", file=sys.stderr)
        return 2

    time_s = data["time_seconds"].to_numpy(dtype=float)
    signal = data["filtered_red_channel"].to_numpy(dtype=float)
    dt = np.diff(time_s)
    dt = dt[np.isfinite(dt) & (dt > 0)]
    fs = 1.0 / float(np.median(dt)) if len(dt) else float("nan")
    duration = float(time_s[-1] - time_s[0])
    if not np.isfinite(fs) or fs <= 0:
        print("Could not estimate sampling frequency from timestamps.", file=sys.stderr)
        return 2

    # Independent simple peak detector. Results are engineering estimates only.
    prominence = max(float(np.std(signal)) * 0.30, 1e-8)
    min_distance = max(1, int(fs * 60.0 / 190.0))
    peaks, _ = find_peaks(signal, distance=min_distance, prominence=prominence)
    ibis_s = np.diff(time_s[peaks]) if len(peaks) >= 2 else np.array([], dtype=float)
    ibis_s = ibis_s[(ibis_s >= 60.0 / 180.0) & (ibis_s <= 60.0 / 40.0)]
    bpm = float(60.0 / np.median(ibis_s)) if len(ibis_s) >= 2 else None

    summary = {
        "input_file": str(path),
        "source": source,
        "sample_count": int(len(data)),
        "duration_seconds": duration,
        "estimated_sampling_rate_hz": fs,
        "independent_peak_count": int(len(peaks)),
        "independent_pulse_rate_bpm": bpm,
        "warning": "Engineering cross-check only; not a clinical measurement or VOC prediction.",
    }
    output_json = path.with_name(path.stem + "-inspection.json")
    output_png = path.with_name(path.stem + "-inspection.png")
    output_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    fig, ax = plt.subplots(figsize=(12, 4.5))
    ax.plot(time_s, signal, linewidth=0.9, label="Filtered red-channel trace")
    if len(peaks):
        ax.scatter(time_s[peaks], signal[peaks], s=18, label="Independent detected peaks")
    ax.set_title("VOCALERT exported signal — engineering inspection only")
    ax.set_xlabel("Time (seconds)")
    ax.set_ylabel("Filtered intensity (arbitrary units)")
    ax.grid(True, alpha=0.25)
    ax.legend(loc="upper right")
    fig.tight_layout()
    fig.savefig(output_png, dpi=160)
    plt.close(fig)

    print(json.dumps(summary, indent=2))
    print(f"\nSaved plot: {output_png}")
    print(f"Saved summary: {output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
