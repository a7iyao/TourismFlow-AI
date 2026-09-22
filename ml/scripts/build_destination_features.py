#!/usr/bin/env python3
"""
build_destination_features.py
==============================

Create the ML model data for the destination similarity prototype.

Source of truth : src/data/destinations.ts (the React destination catalogue)
Output          : ml/data/processed/destination_features.csv

The destination characteristic scores (beach, nature, culture, food, adventure,
heritage, shopping) are REUSED from the existing catalogue. They are prototype /
demonstration features for similarity modeling — NOT official tourism
statistics. Real official POI, geospatial or traveler-preference datasets can
replace this file later without changing the downstream similarity step.

No additional tourism statistics are invented here.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Dict, List
from csv import DictWriter

from dataio import repo_root

DESTINATIONS_TS = os.path.join(repo_root(), "src", "data", "destinations.ts")
OUT_PATH = os.path.join(repo_root(), "ml", "data", "processed", "destination_features.csv")

FEATURE_COLUMNS = [
    "destination",
    "state",
    "latitude",
    "longitude",
    "beach",
    "nature",
    "culture",
    "food",
    "adventure",
    "heritage",
    "shopping",
]

# destination.ts field name -> feature matrix column name.
FIELD_TO_COLUMN = {
    "destination": "destination",
    "state": "state",
    "latitude": "latitude",
    "longitude": "longitude",
    "beachScore": "beach",
    "natureScore": "nature",
    "cultureScore": "culture",
    "foodScore": "food",
    "adventureScore": "adventure",
    "heritageScore": "heritage",
    "shoppingScore": "shopping",
}

# A key/value pair: 'KEY: value' where value is a quoted string, a number or a bool.
FIELD_RE = re.compile(
    r"\b([a-zA-Z]+):\s*(?:'([^']*)'|\"([^\"]*)\"|([0-9]+(?:\.[0-9]+)?)|(true|false))"
)


def parse_blocks(content: str) -> List[Dict[str, str]]:
    """Split the TS array literal into per-destination blocks and parse fields."""
    blocks = re.split(r"\n\s*\{\n", content)[1:]
    parsed: List[Dict[str, str]] = []
    for block in blocks:
        fields = {}
        for match in FIELD_RE.finditer(block):
            key = match.group(1)
            value = next(group for group in match.groups()[1:] if group is not None)
            fields[key] = value
        if fields:
            parsed.append(fields)
    return parsed


def main() -> int:
    if not os.path.exists(DESTINATIONS_TS):
        print(f"ERROR: {DESTINATIONS_TS} not found.", file=sys.stderr)
        return 1

    with open(DESTINATIONS_TS, "r", encoding="utf-8") as handle:
        content = handle.read()

    blocks = parse_blocks(content)
    if not blocks:
        print("ERROR: no destination blocks parsed from destinations.ts.", file=sys.stderr)
        return 1

    rows: List[Dict[str, str]] = []
    for block in blocks:
        missing = [field for field in FIELD_TO_COLUMN if field not in block]
        if missing:
            print(
                "ERROR: destination block missing field(s): " + ", ".join(missing),
                file=sys.stderr,
            )
            return 1
        row = {column: block[field] for field, column in FIELD_TO_COLUMN.items()}

        # Scores are reused as-is; the catalogue already keeps them on 0-100.
        for score_column in ("beach", "nature", "culture", "food", "adventure", "heritage", "shopping"):
            try:
                value = float(row[score_column])
            except ValueError:
                print(f"ERROR: {row['destination']}: {score_column} not numeric.", file=sys.stderr)
                return 1
            if not 0 <= value <= 100:
                print(
                    f"WARNING: {row['destination']}: {score_column}={value} outside 0-100; keeping as-is.",
                    file=sys.stderr,
                )
        rows.append(row)

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = DictWriter(handle, fieldnames=FEATURE_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    print("=" * 52)
    print("destination feature matrix (prototype demonstration features)")
    print("=" * 52)
    print(f"destinations : {len(rows)}")
    print(f"file         : {OUT_PATH}")
    print("NOTE: characteristic scores are reused from src/data/destinations.ts")
    print("      and are prototype demonstration features, not official statistics.")
    return 0


if __name__ == "__main__":
    sys.exit(main())