#!/usr/bin/env python3
"""
build_population_features.py
=============================

SMART DESTINATION AI — Layer 3 population features.

Reads  ml/data/processed/population_state.csv
Writes ml/output/population_features.csv

Validates the population layer and derives transparent population features
used by the tourism pressure pipeline. This is data processing, not a trained
model. No values are fabricated; the resident_population column is the real
Layer 3 source of truth.

Features
--------
* population_growth_pct  = year-on-year resident population growth per state
* population_share_pct   = the state's share of national population in a year
"""

from __future__ import annotations

import os
import sys
from collections import Counter
from typing import Dict, List, Optional

from dataio import format_number, load_rows, parse_float, repo_root

INPUT_PATH = os.path.join(repo_root(), "ml", "data", "processed", "population_state.csv")
OUTPUT_PATH = os.path.join(repo_root(), "ml", "output", "population_features.csv")

REQUIRED_COLUMNS = ["state", "year", "population_thousand", "resident_population"]
NUMERIC_COLUMNS = ["year", "population_thousand", "resident_population"]

OUTPUT_COLUMNS = [
    "state",
    "year",
    "population_thousand",
    "resident_population",
    "population_growth_pct",
    "population_share_pct",
]

# population_thousand is a rounded display figure; allow a small relative gap.
_POPULATION_CONSISTENCY_TOLERANCE = 0.001


def main() -> int:
    if not os.path.exists(INPUT_PATH):
        print(f"ERROR: input not found: {INPUT_PATH}", file=sys.stderr)
        return 1

    rows = load_rows(INPUT_PATH)
    if not rows:
        print("ERROR: input CSV has no data rows.", file=sys.stderr)
        return 1

    headers = list(rows[0].keys())
    missing_columns = [col for col in REQUIRED_COLUMNS if col not in headers]
    if missing_columns:
        print(
            "ERROR: missing required column(s): " + ", ".join(missing_columns),
            file=sys.stderr,
        )
        return 1

    # --- missing values -----------------------------------------------------
    missing_counts = Counter()
    for row in rows:
        for column in REQUIRED_COLUMNS:
            raw = row.get(column, "")
            if raw is None or str(raw).strip() == "":
                missing_counts[column] += 1

    # --- duplicate (state, year) -------------------------------------------
    state_year = Counter((row["state"], row["year"]) for row in rows)
    duplicates = [(key, count) for key, count in state_year.items() if count > 1]
    if duplicates:
        print("ERROR: duplicate (state, year) rows found:", file=sys.stderr)
        for (state, year), count in duplicates:
            print(f"  - {state}, {year} appears {count} times", file=sys.stderr)
        return 1

    # --- numeric + consistency checks --------------------------------------
    parsed: List[Dict[str, object]] = []
    numeric_errors = Counter()
    consistency_warnings: List[str] = []
    for row in rows:
        record: Dict[str, object] = {
            "state": row["state"],
            "year": parse_float(row.get("year")),
        }
        for column in ("population_thousand", "resident_population"):
            value = parse_float(row.get(column))
            if value is None:
                if str(row.get(column, "")).strip() != "":
                    numeric_errors[column] += 1
            record[column] = value

        thousand = record["population_thousand"]
        residents = record["resident_population"]
        if thousand is not None and residents is not None and thousand > 0:
            implied = thousand * 1000
            if abs(implied - residents) / implied > _POPULATION_CONSISTENCY_TOLERANCE:
                consistency_warnings.append(
                    f"{record['state']} {record['year']}: "
                    f"population_thousand*1000 ({implied:.0f}) != "
                    f"resident_population ({residents:.0f})"
                )
        parsed.append(record)

    # --- features -----------------------------------------------------------
    population_by_state_year: Dict[tuple, float] = {}
    for record in parsed:
        if record["resident_population"] is not None:
            population_by_state_year[(record["state"], int(record["year"]))] = float(
                record["resident_population"]
            )

    # national total per year (for share computation)
    totals = Counter()
    for (state, year), population in population_by_state_year.items():
        totals[year] += population

    output_rows: List[Dict[str, object]] = []
    growth_computed = 0
    for record in parsed:
        state = record["state"]
        year = int(record["year"])
        residents = record["resident_population"]
        prior = population_by_state_year.get((state, year - 1))

        growth: Optional[float] = None
        if residents is not None and prior and prior > 0:
            growth = (residents / prior - 1) * 100
            growth_computed += 1

        share: Optional[float] = None
        if residents is not None and totals[year] > 0:
            share = residents / totals[year] * 100

        output_rows.append(
            {
                "state": state,
                "year": year,
                "population_thousand": record["population_thousand"],
                "resident_population": residents,
                "population_growth_pct": growth,
                "population_share_pct": share,
            }
        )

    # --- export -------------------------------------------------------------
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as handle:
        from csv import DictWriter

        writer = DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for record in output_rows:
            writer.writerow(
                {
                    column: (
                        format_number(round(value, 4))
                        if isinstance(value, float)
                        else value
                    )
                    for column, value in record.items()
                }
            )

    # --- summary -------------------------------------------------------------
    states = sorted({str(record["state"]) for record in output_rows})
    years = sorted({int(record["year"]) for record in output_rows})
    total_missing = sum(missing_counts.values())

    print("=" * 60)
    print("SMART DESTINATION AI — Layer 3 population features")
    print("=" * 60)
    print(f"input : {INPUT_PATH}")
    print(f"output: {OUTPUT_PATH}")
    print(f"row count          : {len(output_rows)}")
    print(f"states covered     : {len(states)}")
    print(f"years covered      : {years}")
    print(f"missing values     : {total_missing}")
    if missing_counts:
        for column, count in missing_counts.items():
            print(f"  {column}: {count}")
    print(f"duplicate rows     : {len(duplicates)}")
    print(f"population growth rows computed : {growth_computed}")
    print(f"population_thousand vs resident mismatches : {len(consistency_warnings)}")
    for warning in consistency_warnings:
        print(f"  WARNING: {warning}")
    print("-" * 60)
    print(f"output columns ({len(OUTPUT_COLUMNS)}):")
    for column in OUTPUT_COLUMNS:
        print(f"  {column}")
    print("=" * 60)
    print("NOTE: data processing only — no model training, no fabricated values.")
    return 0


if __name__ == "__main__":
    sys.exit(main())