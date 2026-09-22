#!/usr/bin/env python3
"""
build_tourism_pressure.py
=========================

SMART DESTINATION AI — Tourism Pressure Index (real Layer 1 + Layer 3 data).

Reads  ml/data/processed/tourism_population_merged.csv
Writes ml/output/tourism_pressure.csv

The Tourism Pressure Index is an ANALYTICAL index, NOT a trained supervised ML
model. It is a transparent weighted combination of normalised metrics
(see tourism_pressure.py), so every score and band is explainable.

Components (weights sum to 100%):
  30% tourism_intensity
  20% visitor_growth_pct
  20% tourists
  15% average_length_of_stay
  15% receipts_per_resident_rm

Normalisation: min-max to 0-100 applied WITHIN each year (states are compared
cross-sectionally in the same period).

Bands: 0-39 LOW, 40-69 MODERATE, 70-100 HIGH.

Accommodation (occupancy) is NOT included because that dataset is unavailable;
no occupancy values are fabricated. The component registry and per-row weight
renormalisation below are ready for an occupancy_rate entry when the data
arrives.

Raw values are preserved beside the normalised component scores.
"""

from __future__ import annotations

import os
import sys
from collections import Counter
from typing import Any, Dict, List

from dataio import format_number, load_rows, repo_root
from tourism_pressure import CLASSIFICATION_BANDS, COMPONENTS, classify, min_max_normalize, raw_value

INPUT_PATH = os.path.join(
    repo_root(), "ml", "data", "processed", "tourism_population_merged.csv"
)
OUTPUT_PATH = os.path.join(
    repo_root(), "ml", "output", "tourism_pressure.csv"
)

OUTPUT_COLUMNS = [
    "state",
    "year",
] + [component["key"] for component in COMPONENTS] + [
    "norm_" + component["key"] for component in COMPONENTS
] + [
    "tourism_pressure_index",
    "pressure_band",
]


def normalize_by_year(
    records: List[Dict[str, Any]],
) -> Dict[str, Dict[int, Any]]:
    """Return per-component -> {record_index: norm 0-100 or None}.

    Min-max scaling is applied within each year so periods are never mixed.
    """
    years = sorted({int(record["year"]) for record in records})
    normalised: Dict[str, Dict[int, Any]] = {
        component["key"]: {} for component in COMPONENTS
    }
    for component in COMPONENTS:
        key = component["key"]
        for year in years:
            indices = [i for i, record in enumerate(records) if int(record["year"]) == year]
            values = [records[i][key] for i in indices]
            scaled = min_max_normalize(values)
            for local_index, global_index in enumerate(indices):
                normalised[key][global_index] = scaled[local_index]
    return normalised


def format_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return format_number(value)
    return str(value)


def main() -> int:
    if not os.path.exists(INPUT_PATH):
        print(f"ERROR: input not found: {INPUT_PATH}", file=sys.stderr)
        return 1

    rows = load_rows(INPUT_PATH)
    if not rows:
        print("ERROR: input CSV has no data rows.", file=sys.stderr)
        return 1

    # --- validation ---------------------------------------------------------
    headers = list(rows[0].keys())
    required_columns = ["state", "year"] + [
        component["uses"] for component in COMPONENTS
    ]
    missing_columns = [col for col in required_columns if col not in headers]
    if missing_columns:
        print(
            "ERROR: missing required column(s): " + ", ".join(missing_columns),
            file=sys.stderr,
        )
        return 1

    missing_counts = Counter()
    for row in rows:
        for column in required_columns:
            raw = row.get(column, "")
            if raw is None or str(raw).strip() == "":
                missing_counts[column] += 1

    state_year = Counter((row["state"], row["year"]) for row in rows)
    duplicates = [(key, count) for key, count in state_year.items() if count > 1]
    if duplicates:
        print("ERROR: duplicate (state, year) rows found:", file=sys.stderr)
        for (state, year), count in duplicates:
            print(f"  - {state}, {year} appears {count} times", file=sys.stderr)
        return 1

    # --- records ------------------------------------------------------------
    records: List[Dict[str, Any]] = []
    for row in rows:
        records.append(
            {
                "state": row.get("state", ""),
                "year": row.get("year", ""),
                **{
                    component["key"]: raw_value(component, row)
                    for component in COMPONENTS
                },
            }
        )

    normalised = normalize_by_year(records)

    # --- combine with renormalised weights ---------------------------------
    output_rows: List[Dict[str, Any]] = []
    availability: Dict[str, int] = {c["key"]: 0 for c in COMPONENTS}

    for index, record in enumerate(records):
        available = [
            component
            for component in COMPONENTS
            if normalised[component["key"]][index] is not None
        ]
        total_weight = sum(component["weight"] for component in available)

        combined = 0.0
        for component in available:
            availability[component["key"]] += 1
            share = component["weight"] / total_weight
            combined += normalised[component["key"]][index] * share

        output_rows.append(
            {
                "state": record["state"],
                "year": int(record["year"]),
                **{c["key"]: record[c["key"]] for c in COMPONENTS},
                **{
                    "norm_" + c["key"]: (
                        None
                        if normalised[c["key"]][index] is None
                        else round(normalised[c["key"]][index], 2)
                    )
                    for c in COMPONENTS
                },
                "tourism_pressure_index": round(combined, 2),
                "pressure_band": classify(combined),
            }
        )

    # --- export -------------------------------------------------------------
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as handle:
        from csv import DictWriter

        writer = DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for record in output_rows:
            writer.writerow(
                {column: format_cell(record[column]) for column in OUTPUT_COLUMNS}
            )

    # --- report -------------------------------------------------------------
    states = sorted({str(record["state"]) for record in output_rows})
    years = sorted({int(record["year"]) for record in output_rows})
    total_missing = sum(missing_counts.values())

    print("=" * 60)
    print("SMART DESTINATION AI — Tourism Pressure Index")
    print("=" * 60)
    print(f"input : {INPUT_PATH}")
    print(f"output: {OUTPUT_PATH}")
    print(f"row count      : {len(output_rows)}")
    print(f"states covered : {len(states)}")
    print(f"years covered  : {years}")
    print(f"missing values : {total_missing}")
    print(f"duplicate rows : {len(duplicates)}")
    print("-" * 60)
    print("components:")
    for component in COMPONENTS:
        rows_used = availability[component["key"]]
        status = f"included ({rows_used}/{len(output_rows)})"
        print(
            f"  {component['key']:<24} {component['weight'] * 100:>3.0f}%  {status}"
        )
    print("-" * 60)
    print("pressure bands (documented cutpoints): 0-39 LOW | 40-69 MODERATE | 70-100 HIGH")
    for year in years:
        band_counts = Counter(
            record["pressure_band"]
            for record in output_rows
            if int(record["year"]) == year
        )
        summary = ", ".join(f"{band}={band_counts[band]}" for band in ("LOW", "MODERATE", "HIGH"))
        print(f"  {year}: {summary}")
    print("=" * 60)
    print("RANKED SUMMARY (LOW is least pressured, HIGH is most pressured)")
    for year in years:
        ranked = sorted(
            (record for record in output_rows if int(record["year"]) == year),
            key=lambda record: record["tourism_pressure_index"],
            reverse=True,
        )
        print(f"\n  Year {year}")
        print("   #  state                           index   band")
        for rank, record in enumerate(ranked, start=1):
            state = record["state"]
            if len(state) > 32:
                state = state[:31] + "."
            print(
                f"  {rank:>2}  {state:<32} {record['tourism_pressure_index']:>6.2f}  "
                f"{record['pressure_band']:<10}"
            )
    print("=" * 60)
    print("NOTE: This is an analytical Tourism Pressure Index, NOT a trained")
    print("      supervised ML model. All component scores are explainable.")
    print("NOTE: Accommodation (occupancy_rate) is NOT included because that")
    print("      dataset is unavailable. No occupancy values are fabricated.")
    print("NOTE: Normalisation is within-year min-max to 0-100; raw values are")
    print("      preserved beside the normalised component scores.")
    return 0


if __name__ == "__main__":
    sys.exit(main())