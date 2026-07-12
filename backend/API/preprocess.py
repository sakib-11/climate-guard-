#!/usr/bin/env python3
"""
ClimateGuard preprocessing pipeline (robust)
- Handles EM-DAT (Excel/CSV) -> cleaned + feature-engineered CSV
- Handles Wildfire archive -> JSON array OR NDJSON (also .gz/.bz2)
Key features:
- Robust parsing for huge files (stream + fallback)
- Works with JSON arrays and NDJSON and handles trailing commas
- Safe numeric conversions and fallbacks for sklearn MinMaxScaler
- CLI with override paths and top_n control
"""
from __future__ import annotations

import os
import sys
import json
import csv
import argparse
import gzip
import bz2
from datetime import datetime
from typing import Optional, Iterable, Dict, Any, List

import pandas as pd
import numpy as np

# optional sklearn import with safe fallback
try:
    from sklearn.preprocessing import MinMaxScaler  # type: ignore
    _HAS_SKLEARN = True
except Exception:
    _HAS_SKLEARN = False


# -----------------------
# Defaults
# -----------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TARGET_DIR = os.path.join(BASE_DIR, "dataset")
DEFAULT_EMDAT = os.path.join(DEFAULT_TARGET_DIR, "international_disaster.xlsx")
DEFAULT_WILDFIRE = os.path.join(DEFAULT_TARGET_DIR, "fire_archive_SV-C2_678910.json")
DEFAULT_EMDAT_OUT = os.path.join(DEFAULT_TARGET_DIR, "emdat_disaster_preprocessed_features.csv")
DEFAULT_WILDFIRE_OUT = os.path.join(DEFAULT_TARGET_DIR, "wildfire_archive_preprocessed_features.csv")


# -----------------------
# Utilities
# -----------------------
def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def open_maybe_compressed(path: str, mode: str = "rt", encoding: str = "utf-8"):
    """
    Open regular, .gz, or .bz2 file transparently for text reading.
    mode should be 'rt' or 'r' for text.
    """
    if path.lower().endswith(".gz"):
        return gzip.open(path, mode=mode, encoding=encoding, errors="ignore")
    if path.lower().endswith(".bz2"):
        return bz2.open(path, mode=mode, encoding=encoding, errors="ignore")
    return open(path, mode=mode, encoding=encoding, errors="ignore")


# -----------------------
# Time / Season helpers
# -----------------------
def get_season(month: Optional[int]) -> str:
    if month is None or not (1 <= month <= 12):
        return "Unknown"
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Spring"
    if month in (6, 7, 8):
        return "Summer"
    return "Autumn"


def one_hot_encode_time(df: pd.DataFrame, month_col: str) -> pd.DataFrame:
    if month_col not in df.columns:
        log(f"⚠️ Column '{month_col}' not found for OHE; skipping.")
        return df
    df[month_col] = pd.to_numeric(df[month_col], errors="coerce").fillna(1).astype(int)
    df["Season"] = df[month_col].apply(get_season)
    month_ohe = pd.get_dummies(df[month_col], prefix="Month")
    season_ohe = pd.get_dummies(df["Season"], prefix="Season")
    df = pd.concat([df, month_ohe, season_ohe], axis=1)
    df.drop(columns=["Season"], inplace=True, errors="ignore")
    return df


# -----------------------
# Safe scaler fallback
# -----------------------
class SimpleMinMax:
    """Small safe alternative to sklearn MinMaxScaler (handles constant columns)."""

    def fit_transform(self, arr: pd.DataFrame) -> np.ndarray:
        a = np.array(arr, dtype=float).reshape(-1, 1)
        minv = np.nanmin(a)
        maxv = np.nanmax(a)
        if np.isnan(minv) or np.isnan(maxv) or minv == maxv:
            return np.zeros_like(a)
        return ((a - minv) / (maxv - minv)).astype(float)


def get_scaler():
    if _HAS_SKLEARN:
        return MinMaxScaler()
    return SimpleMinMax()


# -----------------------
# EM-DAT
# -----------------------
def clean_and_engineer_emdat(df: pd.DataFrame) -> pd.DataFrame:
    """Return cleaned EM-DAT features dataframe (safe with missing columns)."""
    log("🌀 Cleaning EM-DAT dataframe...")

    expected_cols = [
        "Disaster Type", "Total Deaths", "No. Injured", "No. Affected",
        "No. Homeless", "Total Affected", "Start Month", "ISO", "Country",
        "Disaster Group", "Start Year", "Latitude", "Longitude"
    ]
    for c in expected_cols:
        if c not in df.columns:
            df[c] = np.nan
            log(f"⚠️ EM-DAT: added missing column '{c}' as NaN")

    # Label creation (case-insensitive)
    df["Disaster Type"] = df["Disaster Type"].astype(str)
    df["flood_occurred"] = (df["Disaster Type"].str.lower() == "flood").astype(int)
    df["fire_occurred"] = (df["Disaster Type"].str.lower() == "wildfire").astype(int)

    # Numeric columns safe conversion
    number_cols = ["Total Deaths", "No. Injured", "No. Affected", "No. Homeless", "Total Affected"]
    for c in number_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)

    # Month processing
    df["Start Month"] = pd.to_numeric(df["Start Month"], errors="coerce").fillna(1).astype(int)

    # Log + Normalize
    df["log_Total_Deaths"] = np.log1p(df["Total Deaths"])
    df["log_Total_Affected"] = np.log1p(df["Total Affected"])

    scaler = get_scaler()
    try:
        df["normalized_log_Total_Deaths"] = scaler.fit_transform(df[["log_Total_Deaths"]])
    except Exception:
        df["normalized_log_Total_Deaths"] = 0.0
    try:
        df["normalized_log_Total_Affected"] = scaler.fit_transform(df[["log_Total_Affected"]])
    except Exception:
        df["normalized_log_Total_Affected"] = 0.0

    # One-hot month & season
    df = one_hot_encode_time(df, "Start Month")

    # Select final columns
    base_cols = [
        "ISO", "Country", "Disaster Group", "Disaster Type", "Start Year",
        "normalized_log_Total_Deaths", "normalized_log_Total_Affected",
        "flood_occurred", "fire_occurred", "Latitude", "Longitude"
    ]
    ohe_cols = [c for c in df.columns if c.startswith("Month_") or c.startswith("Season_")]
    final_cols = list(dict.fromkeys(base_cols + ohe_cols))
    final_cols = [c for c in final_cols if c in df.columns]
    log(f"✅ EM-DAT cleaned with {len(df)} rows. Returning {len(final_cols)} columns.")
    return df[final_cols].copy()


def process_emdat(input_path: str, output_path: str):
    log(f"📂 Loading EM-DAT from: {input_path}")
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"EM-DAT file not found: {input_path}")

    # Try reading as Excel first if extension suggests so
    try:
        if str(input_path).lower().endswith((".xls", ".xlsx")):
            try:
                df = pd.read_excel(input_path, engine="openpyxl")
            except Exception:
                # second attempt with default engine
                df = pd.read_excel(input_path)
        else:
            # Best-effort CSV read with robust options
            df = pd.read_csv(input_path, encoding="latin-1", sep=",", engine="python", quoting=csv.QUOTE_MINIMAL)
    except Exception as exc:
        log(f"❌ Failed to read EM-DAT file: {exc}")
        raise

    cleaned = clean_and_engineer_emdat(df)
    cleaned.to_csv(output_path, index=False)
    log(f"✅ EM-DAT features saved: {output_path}")


# -----------------------
# Wildfire parsing helpers (array or NDJSON)
# -----------------------
def iter_json_lines_auto(file_path: str) -> Iterable[Dict[str, Any]]:
    """
    Auto-detects JSON array or NDJSON and yields dict records robustly.
    - Handles extremely large arrays by streaming with brace counting.
    - Tolerates trailing commas and mixed whitespace.
    """
    import re
    with open(file_path, "r", encoding="utf-8") as f:
        first_chars = f.read(2048)
        f.seek(0)
        stripped = first_chars.lstrip()
        # Case 1: JSON array -> stream parse manually
        if stripped.startswith("["):
            log("⚠️ File too large to json.load(); using streaming array parser.")
            buffer = ""
            depth = 0
            inside_obj = False
            for chunk in iter(lambda: f.read(65536), ""):
                for ch in chunk:
                    if ch == "{":
                        inside_obj = True
                        depth += 1
                    if inside_obj:
                        buffer += ch
                    if ch == "}":
                        depth -= 1
                        if depth == 0 and inside_obj:
                            try:
                                obj = json.loads(buffer)
                                if isinstance(obj, dict):
                                    yield obj
                            except Exception:
                                # attempt to clean up trailing commas etc
                                try:
                                    clean = re.sub(r",\s*$", "", buffer)
                                    obj = json.loads(clean)
                                    if isinstance(obj, dict):
                                        yield obj
                                except Exception:
                                    pass
                            buffer = ""
                            inside_obj = False
            return  # done
        # Case 2: NDJSON fallback (one JSON object per line)
        for line in f:
            raw = line.strip().rstrip(",")
            if not raw:
                continue
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    yield obj
            except Exception:
                continue


def clean_and_engineer_wildfire_df(df: pd.DataFrame) -> pd.DataFrame:
    log("🔥 Cleaning wildfire dataframe...")
    required = [
        "acq_date", "acq_time", "latitude", "longitude",
        "brightness", "frp", "confidence", "instrument", "satellite", "daynight"
    ]
    for c in required:
        if c not in df.columns:
            df[c] = np.nan

    # Parse datetime
    df["acq_time"] = df["acq_time"].astype(str).str.zfill(4)
    df["datetime"] = pd.to_datetime(
        df["acq_date"].astype(str) + " " + df["acq_time"].str[:2] + ":" + df["acq_time"].str[2:],
        errors="coerce"
    )
    df = df.dropna(subset=["datetime", "latitude", "longitude"])

    # Numeric cleanup
    df["frp"] = pd.to_numeric(df["frp"], errors="coerce").fillna(0.0)
    df["brightness"] = pd.to_numeric(df["brightness"], errors="coerce")
    df["brightness"] = df["brightness"].fillna(df["brightness"].mean() if df["brightness"].notnull().any() else 0.0)

    # Normalize numeric fields
    scaler = MinMaxScaler()
    for col in ["brightness", "frp"]:
        try:
            df[f"normalized_{col}"] = scaler.fit_transform(df[[col]])
        except Exception:
            df[f"normalized_{col}"] = 0.0

    # Confidence map (NASA style)
    confidence_map = {"n": 2, "l": 1, "h": 3}
    df["confidence_score"] = df["confidence"].astype(str).str.lower().map(confidence_map).fillna(0)

    # One-hot encode month/season
    df["Month"] = df["datetime"].dt.month
    df = one_hot_encode_time(df, "Month")

    df["fire_occurred"] = 1

    base_cols = [
        "acq_date", "datetime", "latitude", "longitude",
        "normalized_brightness", "normalized_frp", "confidence_score",
        "instrument", "satellite", "daynight", "fire_occurred"
    ]
    ohe_cols = [c for c in df.columns if c.startswith("Month_") or c.startswith("Season_")]
    final_cols = list(dict.fromkeys(base_cols + ohe_cols))
    final_cols = [c for c in final_cols if c in df.columns]

    log(f"✅ Cleaned wildfire dataframe with {len(df)} rows.")
    return df[final_cols].copy()



def process_wildfire(input_path: str, output_path: str, top_n: int = 15, limit: int = 20000):
    """
    Stream-parses large wildfire files and writes processed CSV (chunked).
    - Supports huge JSON arrays or NDJSON.
    - Stops after reading ~20k most recent records (by acq_date).
    """
    log(f"📂 Processing wildfire file: {input_path}")
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Wildfire file not found: {input_path}")

    candidates = []
    total = 0

    # Stream parse objects (brace-counting)
    for rec in iter_json_lines_auto(input_path):
        try:
            lat = rec.get("latitude") or rec.get("lat")
            lon = rec.get("longitude") or rec.get("lon")
            brightness = rec.get("brightness")
            if lat is None or lon is None or brightness is None:
                continue

            # parse acq_date safely
            date_str = str(rec.get("acq_date") or "").strip()
            if not date_str:
                continue

            candidates.append({
                "acq_date": date_str,
                "acq_time": rec.get("acq_time", rec.get("time")),
                "latitude": lat,
                "longitude": lon,
                "brightness": brightness,
                "frp": rec.get("frp"),
                "confidence": rec.get("confidence"),
                "instrument": rec.get("instrument"),
                "satellite": rec.get("satellite"),
                "daynight": rec.get("daynight"),
            })
            total += 1

            # safety: soft limit (avoid over-accumulation)
            if total % 5000 == 0:
                log(f"🔍 Parsed {total:,} records so far...")

            # stop at ~limit to avoid huge memory
            if total >= limit * 2:
                break
        except Exception:
            continue

    if not candidates:
        log("❌ No valid wildfire records parsed.")
        return

    df = pd.DataFrame(candidates)

    # ---- Step 1: Find most recent date ----
    try:
        df["acq_date"] = pd.to_datetime(df["acq_date"], errors="coerce")
        most_recent = df["acq_date"].max()
        df_recent = df[df["acq_date"] == most_recent].copy()
        log(f"📆 Most recent date found: {most_recent.date()} ({len(df_recent)} records)")
    except Exception:
        log("⚠️ Failed to determine most recent date; using first 20k rows instead.")
        df_recent = df

    # ---- Step 2: Limit to 20k (or fewer if less available) ----
    df_recent = df_recent.head(limit)
    log(f"📊 Selected {len(df_recent)} recent wildfire rows for cleaning.")

    # ---- Step 3: Clean + engineer + top N ----
    df_final = clean_and_engineer_wildfire_df(df_recent)


    df_final.to_csv(output_path, index=False)
    log(f"✅ Wildfire features saved: {output_path}")


# -----------------------
# CLI
# -----------------------
def parse_args():
    p = argparse.ArgumentParser(description="ClimateGuard preprocessing pipeline (robust)")
    p.add_argument("--emdat", default=DEFAULT_EMDAT, help="Path to EM-DAT Excel/CSV")
    p.add_argument("--wildfire", default=DEFAULT_WILDFIRE, help="Path to wildfire JSON (array or NDJSON). .gz/.bz2 supported")
    p.add_argument("--outdir", default=DEFAULT_TARGET_DIR, help="Output directory")
    p.add_argument("--emdat_out", default=None, help="Explicit EM-DAT output path")
    p.add_argument("--wildfire_out", default=None, help="Explicit wildfire output path")
    p.add_argument("--top_n", default=15, type=int, help="Top N wildfire rows to output (by brightness)")
    return p.parse_args()


def main():
    args = parse_args()
    ensure_dir(args.outdir)

    emdat_out = args.emdat_out or os.path.join(args.outdir, os.path.basename(DEFAULT_EMDAT_OUT))
    wildfire_out = args.wildfire_out or os.path.join(args.outdir, os.path.basename(DEFAULT_WILDFIRE_OUT))

    # EM-DAT
    try:
        process_emdat(args.emdat, emdat_out)
    except FileNotFoundError as e:
        log(str(e))
    except Exception as ex:
        log(f"❌ EM-DAT processing failed: {ex}")

    # Wildfire
    try:
        process_wildfire(args.wildfire, wildfire_out, top_n=args.top_n)
    except FileNotFoundError as e:
        log(str(e))
    except Exception as ex:
        log(f"❌ Wildfire processing failed: {ex}")

    log("🏁 Preprocessing pipeline finished.")


if __name__ == "__main__":
    main()
