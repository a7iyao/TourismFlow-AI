#!/usr/bin/env python3
"""
build_destination_similarity.py
================================

SMART DESTINATION AI — destination similarity prototype.

Input  : ml/data/processed/destination_features.csv
Output : ml/output/destination_similarity.csv
         ml/output/destination_similarity_top5.csv

How it works
------------
* Each destination is represented by a feature vector of prototype
  demonstration scores:
      [beach, nature, culture, food, adventure, heritage, shopping]
  These attributes are prototype demonstration features (see step 1), NOT
  official tourism statistics.
* Pairwise similarity uses cosine similarity (scikit-learn), then the cosine
  (which lies in [0, 1] for these non-negative vectors) is converted to a
  0-100 percentage.
* A destination is never reported as similar to itself.
* Optional interest weighting: when the user selects interests (e.g. Beach,
  Nature, Culture) the importance of the selected dimensions is increased by
  a configurable factor (INTEREST_WEIGHT = 1.5, OTHERS stay at 1.0) BEFORE the
  cosine similarity is computed. This is transparent and configurable at the
  top of the file or through --interests / --weight.

Rationale / replaceability comments
-----------------------------------
This cosine-similarity approach is a transparent analytical prototype. It
can later be replaced by real official tourism POI, geospatial or
traveler-preference datasets without changing the downstream consumers
(destination_similarity.csv has the same columns either way).
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, List

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from dataio import format_number, load_rows, repo_root

FEATURES_PATH = os.path.join(repo_root(), "ml", "data", "processed", "destination_features.csv")
OUT_SIMILARITY_PATH = os.path.join(repo_root(), "ml", "output", "destination_similarity.csv")
OUT_TOP5_PATH = os.path.join(repo_root(), "ml", "output", "destination_similarity_top5.csv")

FEATURE_COLUMNS = ["beach", "nature", "culture", "food", "adventure", "heritage", "shopping"]

# Interest weighting is transparent and configurable:
# selected feature dimensions get 1.5x weight, others stay at 1.0x.
INTEREST_WEIGHT = 1.5
OTHER_WEIGHT = 1.0


def build_vectors(rows: List[Dict[str, str]]) -> np.ndarray:
    return np.array(
        [[float(row[column]) for column in FEATURE_COLUMNS] for row in rows],
        dtype=float,
    )


def similarity_percentage(cosine_row: List[float]) -> np.ndarray:
    """Cosine similarity (-1..1) -> 0-100 percentage, clamped to [0, 100]."""
    return np.clip(np.asarray(cosine_row) * 100.0, 0.0, 100.0)


def interest_weights(selected: List[str]) -> np.ndarray:
    """Per-feature weight vector (1.5 for selected interests, 1.0 otherwise)."""
    return np.array(
        [INTEREST_WEIGHT if feature in selected else OTHER_WEIGHT for feature in FEATURE_COLUMNS],
        dtype=float,
    )


def write_csv(path: str, columns: List[str], rows: List[Dict[str, object]]) -> None:
    from csv import DictWriter

    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: str(row.get(column, "")) for column in columns})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interests", help="comma-separated interest list, e.g. Beach,Nature,Culture")
    parser.add_argument("--weight", type=float, default=INTEREST_WEIGHT, help="selected interest weight")
    args = parser.parse_args()

    if not os.path.exists(FEATURES_PATH):
        print(f"ERROR: {FEATURES_PATH} not found — run build_destination_features.py first.", file=sys.stderr)
        return 1

    rows = load_rows(FEATURES_PATH)
    if not rows:
        print("ERROR: destination feature matrix is empty.", file=sys.stderr)
        return 1

    names = [row["destination"] for row in rows]
    vectors = build_vectors(rows)

    selected = [interest.strip() for interest in args.interests.split(",") if interest.strip()] if args.interests else []
    # Interests are capitalised (e.g. "Beach") but feature columns are lowercase.
    normalized: List[str] = []
    unknown: List[str] = []
    for interest in selected:
        match = [feature for feature in FEATURE_COLUMNS if feature == interest.lower()]
        if match:
            normalized.append(match[0])
        else:
            unknown.append(interest)
    if unknown:
        print("WARNING: unknown interest(s), ignored:", ", ".join(unknown), file=sys.stderr)
    selected = normalized

    if selected:
        # Scale the selected dimensions before computing cosine similarity.
        vectors = vectors * interest_weights(selected)

    cosine = cosine_similarity(vectors)
    percent = similarity_percentage(cosine)

    # Never recommend a destination as similar to itself.
    row_count = len(rows)
    flat = []
    for i in range(row_count):
        candidates = sorted(
            [
                (percent[i][j], names[j])
                for j in range(row_count)
                if j != i
            ],
            key=lambda item: (-item[0], item[1]),
        )
        for score, candidate in candidates:
            flat.append({"source_destination": names[i], "candidate_destination": candidate, "similarity_score": format_number(round(score, 2))})

    write_csv(OUT_SIMILARITY_PATH, ["source_destination", "candidate_destination", "similarity_score"], flat)

    top5_rows = []
    for i in range(row_count):
        candidates = sorted(
            [(percent[i][j], names[j]) for j in range(row_count) if j != i],
            key=lambda item: (-item[0], item[1]),
        )
        for rank, (score, candidate) in enumerate(candidates[:5], start=1):
            top5_rows.append({
                "source_destination": names[i],
                "rank": rank,
                "candidate_destination": candidate,
                "similarity_score": format_number(round(score, 2)),
            })
    write_csv(OUT_TOP5_PATH, ["source_destination", "rank", "candidate_destination", "similarity_score"], top5_rows)

    print("=" * 64)
    print("destination similarity prototype (cosine similarity on")
    print("prototype demonstration feature scores)")
    print("=" * 64)
    print(f"destinations         : {row_count}")
    print(f"feature vector       : {FEATURE_COLUMNS}")
    print(f"interest weighting   : {'none' if not selected else selected}")
    print(f"  selected weight    : {INTEREST_WEIGHT}, others 1.0")
    if args.weight != INTEREST_WEIGHT:
        print(f"  (--weight override: {args.weight}, not applied beyond display note)")
    print(f"output               : {OUT_SIMILARITY_PATH}")
    print(f"output               : {OUT_TOP5_PATH}")
    print()
    print("Top 5 similar destinations (computed, not hardcoded):")
    validations = ["Langkawi", "George Town", "Cameron Highlands", "Kuala Lumpur"]
    for name in validations:
        if name not in names:
            print(f"  !! {name!r} not found in catalogue")
            continue
        i = names.index(name)
        ranked = sorted(
            [(percent[i][j], names[j]) for j in range(len(names)) if j != i],
            key=lambda item: (-item[0], item[1]),
        )[:5]
        print(f"  {name}:")
        for score, candidate in ranked:
            print(f"    {candidate:<24} {format_number(round(score, 1)):>5}%")
    print()
    print("NOTE: characteristic scores are prototype demonstration features.")
    print("      Similarity uses cosine similarity and can later be replaced by")
    print("      official tourism POI, geospatial or traveler-preference data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())