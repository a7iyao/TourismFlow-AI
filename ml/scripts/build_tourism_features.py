#!/usr/bin/env python3
"""
build_tourism_features.py
=========================

SMART DESTINATION AI — Layer 1 tourism dataset -> feature table.

This is a data-processing / feature-engineering step. It is NOT a trained
machine learning model. It reads the Layer 1 state-year tourism dataset,
validates it, and derives a small set of transparent tourism features that
later scripts can use (e.g. clustering, similarity ranking, and a future
Tourism Pressure Index).

Pipeline conventions
--------------------
Raw sources live in     ml/data/raw/
Canonical processed in  ml/data/processed/tourism_state.csv
Features exported to    ml/output/tourism_features.csv

Scope
-----
* visitors_per_trip     = visitors / trips
* receipts_per_visitor  = receipts_rm_million / visitors
* receipts_per_trip     = receipts_rm_million / trips
* tourists_share        = tourists / visitors     (share of arrivals that are
                                                   foreign/international tourists)
* visitor_growth_pct is preserved unchanged.

NOT created here
----------------
* The final Tourism Pressure Index is intentionally NOT built in this script.
* No population or accommodation values are invented. Placeholder columns
  (resident_population, tourism_intensity, occupancy_rate) are reserved as
  empty so real official data (DOSM population census, accommodation supply)
  can be joined in later without restructuring.
"""

from __future__ import annotations

import csv
import os
import sys
from collections import Counter
from typing import Dict, List, Optional

from dataio import format_number, load_rows, parse_float, repo_root

INPUT_PATH = os.path.join(repo_root(), "ml", "data", "processed", "tourism_state.csv")
OUTPUT_PATH = os.path.join(repo_root(), "ml", "output", "tourism_features.csv")

REQUIRED_COLUMNS = [
    "state",
    "year",
    "visitors",
    "tourists",
    "trips",
    "receipts_rm_million",
    "average_length_of_stay",
    "visitor_growth_pct",
    "source_file",
]

NUMERIC_COLUMNS = [
    "year",
    "visitors",
    "tourists",
    "trips",
    "receipts_rm_million",
    "average_length_of_stay",
    "visitor_growth_pct",
]

# Reserved for real official data -- left empty on purpose.
PLACEHOLDER_COLUMNS = [
    "resident_population",
    "tourism_intensity",
    "occupancy_rate",
]

DERIVED_COLUMNS = [
    "visitors_per_trip",
    "receipts_per_visitor",
    "receipts_per_trip",
    "tourists_share",
]

OUTPUT_COLUMNS = (
    REQUIRED_COLUMNS + DERIVED_COLUMNS + PLACEHOLDER_COLUMNS
)


def safe_ratio(numerator: float, denominator: float) -> Optional[float]:
    """Return numerator/denominator, or None when it is undefined.

    We never invent a value when the denominator is zero.
    """
    if denominator == 0:
        return None
    return numerator / denominator


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
            "ERROR: missing required column(s): "
            + ", ".join(missing_columns),
            file=sys.stderr,
        )
        return 1

    # --- missing values per column -----------------------------------------
    missing_counts = Counter()
    for row in rows:
        for column in REQUIRED_COLUMNS:
            raw = row.get(column, "")
            if raw is None or raw.strip() == "":
                missing_counts[column] += 1

    # --- duplicate state-year rows -----------------------------------------
    state_year = Counter((row["state"], row["year"]) for row in rows)
    duplicates = [(key, count) for key, count in state_year.items() if count > 1]
    if duplicates:
        print("ERROR: duplicate (state, year) rows found:", file=sys.stderr)
        for (state, year), count in duplicates:
            print(f"  - {state}, {year} appears {count} times", file=sys.stderr)
        return 1

    # --- coerce numeric columns --------------------------------------------
    numeric_errors = Counter()
    parsed: List[Dict[str, object]] = []
    for row in rows:
        parsed_row: Dict[str, object] = {}
        for column, raw in row.items():
            if column in NUMERIC_COLUMNS:
                number = parse_float(raw)
                if number is None and raw.strip() != "":
                    numeric_errors[column] += 1
                parsed_row[column] = number
            else:
                parsed_row[column] = raw
        parsed.append(parsed_row)

    if numeric_errors:
        print("WARNING: unparsable numeric values ignored:", file=sys.stderr)
        for column, count in numeric_errors.items():
            print(f"  - {column}: {count} row(s)", file=sys.stderr)

    # --- build features ----------------------------------------------------
    output_rows: List[Dict[str, object]] = []
    for row in parsed:
        visitors = row["visitors"] or 0
        tourists = row["tourists"] or 0
        trips = row["trips"] or 0
        receipts = row["receipts_rm_million"] or 0

        output_rows.append(
            {
                **{col: row[col] for col in REQUIRED_COLUMNS},
                "visitors_per_trip": safe_ratio(float(visitors), float(trips)),
                "receipts_per_visitor": safe_ratio(float(receipts), float(visitors)),
                "receipts_per_trip": safe_ratio(float(receipts), float(trips)),
                "tourists_share": safe_ratio(float(tourists), float(visitors)),
                # Reserved placeholders -- do NOT fabricate. Real values will be
                # joined from official population / accommodation data later.
                **{col: "" for col in PLACEHOLDER_COLUMNS},
            }
        )

    # --- export ------------------------------------------------------------
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for row in output_rows:
            writer.writerow(
                {
                    col: (
                        format_number(value)
                        if isinstance(value, float)
                        else value
                    )
                    for col, value in row.items()
                }
            )

    # --- summary -----------------------------------------------------------
    states = sorted(set(str(row["state"]) for row in parsed))
    years = sorted({int(row["year"]) for row in parsed if row["year"] is not None})
    total_missing = sum(missing for missing in missing_counts.values())

    print("=" * 60)
    print("SMART DESTINATION AI — Layer 1 tourism features")
    print("=" * 60)
    print(f"input : {INPUT_PATH}")
    print(f"output: {OUTPUT_PATH}")
    print("-" * 60)
    print(f"row count      : {len(output_rows)}")
    print(f"states covered : {len(states)} ({', '.join(states)})")
    print(f"years covered  : {years}")
    print(f"missing values : {total_missing}")
    if missing_counts:
        for column, count in missing_counts.items():
            print(f"  {column}: {count}")
    else:
        print("  (none)")
    print(f"unparsable numeric values: {sum(numeric_errors.values())}")
    print(f"duplicate (state, year) rows: {len(duplicates)}")
    print("-" * 60)
    print(f"output columns ({len(OUTPUT_COLUMNS)}):")
    for column in OUTPUT_COLUMNS:
        print(f"  {column}")
    print("=" * 60)
    print("NOTE: This is feature engineering, not a trained ML model.")
    print("NOTE: Tourism Pressure Index intentionally NOT built here;")
    print("      resident_population / tourism_intensity / occupancy_rate are")
    print("      reserved empty placeholders pending official data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())