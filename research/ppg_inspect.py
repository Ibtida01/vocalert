#!/usr/bin/env python3
"""Independent engineering inspection of a VOCALERT raw PPG CSV export.

This tool is for signal-debugging only. It does not estimate VOC risk, SpO2,
blood pressure, vascular disease, or diagnose any medical condition.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import butter, find_peaks, sosfiltfilt


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


def autocorrelation_rate(signal: np.ndarray, fs: float) -> tuple[float | None, float | None]:
    if len(signal) < int(fs * 5):
        return None, None
    centered = signal - np.mean(signal)
    min_lag = max(2, round(fs * 60 / 180))
    max_lag = min(int(fs * 60 / 40), len(centered) // 3)
    correlations: dict[int, float] = {}
    for lag in range(min_lag, max_lag + 1):
        left = centered[:-lag]
        right = centered[lag:]
        denominator = np.sqrt(np.dot(left, left) * np.dot(right, right))
        correlations[lag] = float(np.dot(left, right) / denominator) if denominator > 0 else -1.0
    if not correlations:
        return None, None
    global_max = max(correlations.values())
    global_lag = max(correlations, key=correlations.get)
    selected_lag = global_lag
    for lag in range(min_lag + 1, max_lag):
        current = correlations[lag]
        if current >= 0.90 * global_max and current > correlations[lag - 1] and current >= correlations[lag + 1]:
            selected_lag = lag
            break
    correlation = correlations[selected_lag]
    previous = correlations.get(selected_lag - 1)
    following = correlations.get(selected_lag + 1)
    adjusted_lag = float(selected_lag)
    if previous is not None and following is not None:
        denominator = previous - 2 * correlation + following
        if abs(denominator) > 1e-9:
            adjustment = 0.5 * (previous - following) / denominator
            adjusted_lag += float(np.clip(adjustment, -0.5, 0.5))
    bpm = 60 * fs / adjusted_lag
    return (float(bpm) if 40 <= bpm <= 180 else None), float(correlation)


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
    required = {"time_seconds", "red_channel_mean"}
    missing = required.difference(data.columns)
    if missing:
        parser.error(f"Missing required columns: {sorted(missing)}")
    data = data.replace([np.inf, -np.inf], np.nan).dropna(subset=["time_seconds", "red_channel_mean"])
    data = data.sort_values("time_seconds").drop_duplicates(subset=["time_seconds"])
    if len(data) < 150:
        print(f"Only {len(data)} valid samples: too short for this inspection.", file=sys.stderr)
        return 2

    time_s = data["time_seconds"].to_numpy(dtype=float)
    red = data["red_channel_mean"].to_numpy(dtype=float)
    delta = np.diff(time_s)
    delta = delta[np.isfinite(delta) & (delta > 0)]
    duration = float(time_s[-1] - time_s[0])
    effective_rate = float((len(time_s) - 1) / duration) if duration > 0 else float("nan")
    median_interval_rate = float(1 / np.median(delta)) if len(delta) else float("nan")
    interval_cv_pct = float(np.std(delta) / np.mean(delta) * 100) if len(delta) else float("nan")
    if not np.isfinite(effective_rate) or effective_rate < 10:
        print("Effective captured sample rate is too low for this inspection.", file=sys.stderr)
        return 2

    # Recompute from the raw RGB time series instead of trusting the browser's
    # mapped filtered_red_channel column. This makes the inspection independent.
    analysis_fs = 30.0
    uniform_time = np.arange(time_s[0], time_s[-1], 1 / analysis_fs)
    uniform_red = np.interp(uniform_time, time_s, red)
    centered = uniform_red - np.mean(uniform_red)
    sos = butter(2, [0.5, 4.0], btype="bandpass", fs=analysis_fs, output="sos")
    filtered = sosfiltfilt(sos, centered)
    prominence = max(float(np.std(filtered)) * 0.42, 1e-8)
    min_distance = max(1, int(analysis_fs * 60 / 190))
    troughs, properties = find_peaks(-filtered, distance=min_distance, prominence=prominence)
    ibi_s = np.diff(troughs) / analysis_fs if len(troughs) >= 2 else np.array([], dtype=float)
    physiological = ibi_s[(ibi_s >= 60 / 180) & (ibi_s <= 60 / 40)]
    trough_bpm = float(60 / np.median(physiological)) if len(physiological) >= 2 else None
    ac_bpm, ac_strength = autocorrelation_rate(filtered[int(1.5 * analysis_fs):], analysis_fs)

    bpm_disagreement = None
    bpm = None
    if trough_bpm is not None and ac_bpm is not None:
        bpm_disagreement = abs(trough_bpm - ac_bpm)
        if bpm_disagreement <= 12:
            bpm = float(np.median([trough_bpm, ac_bpm]))
    else:
        bpm = trough_bpm if trough_bpm is not None else ac_bpm

    summary = {
        "input_file": str(path),
        "source": source,
        "sample_count": int(len(data)),
        "duration_seconds": duration,
        "effective_captured_samples_per_second": effective_rate,
        "median_interval_rate_hz": median_interval_rate,
        "frame_interval_cv_pct": interval_cv_pct,
        "analysis_sampling_rate_hz": analysis_fs,
        "trough_count": int(len(troughs)),
        "pulse_rate_from_troughs_bpm": trough_bpm,
        "pulse_rate_from_autocorrelation_bpm": ac_bpm,
        "pulse_rate_disagreement_bpm": bpm_disagreement,
        "exploratory_pulse_rate_bpm": bpm,
        "autocorrelation_strength": ac_strength,
        "warning": "Independent engineering cross-check only; not a clinical measurement or VOC prediction.",
    }
    output_json = path.with_name(path.stem + "-inspection.json")
    output_png = path.with_name(path.stem + "-inspection.png")
    output_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    fig, ax = plt.subplots(figsize=(12, 4.5))
    ax.plot(uniform_time - uniform_time[0], filtered, linewidth=0.9, label="Independently filtered red-channel trace")
    if len(troughs):
        ax.scatter((uniform_time[troughs] - uniform_time[0]), filtered[troughs], s=18, label="Downward red-channel troughs")
    ax.set_title("VOCALERT exported signal — independent engineering inspection only")
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
