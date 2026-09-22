#!/usr/bin/env python3
"""
build_sustainable_diversion.py
==============================

SMART DESTINATION AI — Sustainable Diversion Engine (prototype).

Combines destination similarity (cosine), state-level tourism pressure,
economic opportunity and rail-based sustainable mobility into one
"alternative destination" score, exported as a COMPACT JSON for the frontend.

Inputs (small files only — the 269 MB rail_features.csv is NEVER read):
  ml/data/processed/destination_features.csv   (prototype characteristic scores)
  ml/data/processed/destination_gateway.csv    (prototype rail accessibility)
  ml/output/tourism_pressure.csv               (state-level pressure index)
  ml/output/tourism_features.csv               (state tourists + receipts)
  ml/output/rail_forecast.csv                  (compact per-station congestion)

Output:
  ml/output/sustainable_diversion.json         (compact, frontend-ready)

Scoring (transparent analytical prototype, NOT official classifications):

  similarity           = weighted cosine similarity of the 7 characteristic
                         dimensions (Beach, Nature, Culture, Food, Adventure,
                         Heritage, Shopping). Selected interests get weight
                         1.5, others 1.0. A destination is never similar to
                         itself. Result scaled 0-100.

  lower_pressure_score = 100 - tourism_pressure_index (state-level).

  economic_opportunity = 0.40 * demand_potential
                       + 0.30 * receipts_potential
                       + 0.30 * available_pressure_capacity
                         where capacity = 100 - tourism_pressure_index and
                         demand/receipts are min-max normalised per state.

  sustainable_mobility = 0.60 * rail_accessibility_score
                       + 0.40 * low_rail_congestion_score (100 - rail
                         congestion). Rail congestion is a per-station mean of
                         the predicted-ridership congestion_score columns from
                         the rail forecast. Destinations without a meaningful
                         rail gateway use their documented low accessibility
                         score and treat congestion as nil.

  final score         = 0.35 * similarity
                      + 0.30 * lower_pressure_score
                      + 0.20 * economic_opportunity
                      + 0.15 * sustainable_mobility
                        clamped to 0-100.

All labels (rail accessibility, congestion bands, economic opportunity) are
analytical prototype categories for this prototype.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from dataio import load_rows, repo_root

PROCESSED_DIR = os.path.join(repo_root(), "ml", "data", "processed")
OUTPUT_DIR = os.path.join(repo_root(), "ml", "output")

FEATURES_PATH = os.path.join(PROCESSED_DIR, "destination_features.csv")
GATEWAY_PATH = os.path.join(PROCESSED_DIR, "destination_gateway.csv")
PRESSURE_PATH = os.path.join(OUTPUT_DIR, "tourism_pressure.csv")
TOURISM_PATH = os.path.join(OUTPUT_DIR, "tourism_features.csv")
RAIL_FORECAST_PATH = os.path.join(OUTPUT_DIR, "rail_forecast.csv")
DEFAULT_OUTPUT_PATH = os.path.join(OUTPUT_DIR, "sustainable_diversion.json")

CHARACTERISTICS = ["beach", "nature", "culture", "food", "adventure", "heritage", "shopping"]

INTEREST_WEIGHT = 1.5
OTHER_WEIGHT = 1.0

SCORE_WEIGHTS = {
    "similarity": 0.35,
    "lower_pressure": 0.30,
    "economic_opportunity": 0.20,
    "sustainable_mobility": 0.15,
}

# destinations.ts state names -> tourism dataset state names.
STATE_ALIASES = {
    "Penang": "Pulau Pinang",
    "Federal Territory of Kuala Lumpur": "W.P. Kuala Lumpur",
    "Federal Territory of Putrajaya": "W.P. Putrajaya",
}

ECONOMIC_WEIGHTS = {"demand": 0.40, "receipts": 0.30, "capacity": 0.30}
MOBILITY_WEIGHTS = {"rail_accessibility": 0.60, "low_congestion": 0.40}

TARGET_YEAR = "2023"


def to_state_key(state: str) -> str:
    return STATE_ALIASES.get(state, state)


def min_max_100(values: List[float]) -> Dict[str, float]:
    """Min-max normalise a {state: value} series to 0-100."""
    numbers = [v for v in values.values() if v is not None]
    low, high = (min(numbers), max(numbers)) if numbers else (0.0, 1.0)
    if high == low:
        return {k: 50.0 for k in values}
    return {k: (v - low) / (high - low) * 100.0 if v is not None else 50.0 for k, v in values.items()}


def interest_selection(interests: List[str]) -> List[str]:
    """Map capitalised interest names to lowercase characteristic fields."""
    selected: List[str] = []
    for interest in interests:
        match = [feature for feature in CHARACTERISTICS if feature == interest.strip().lower()]
        if match:
            selected.append(match[0])
    return selected


def title_case(feature: str) -> str:
    one_word = {"food", "culture", "nature", "beach", "adventure", "heritage", "shopping"}
    return feature.title() if feature in one_word else feature.title()


def load_destination_features() -> List[Dict[str, Any]]:
    rows = load_rows(FEATURES_PATH)
    parsed = []
    for row in rows:
        parsed.append({
            "destination": row["destination"],
            "state": row["state"],
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "characteristics": {
                feature: float(row[feature]) for feature in CHARACTERISTICS
            },
        })
    return parsed


def load_gateway() -> Dict[str, Dict[str, Any]]:
    gateway: Dict[str, Dict[str, Any]] = {}
    for row in load_rows(GATEWAY_PATH):
        gateway[row["destination"]] = {
            "gateway_station": row["gateway_station"].strip(),
            "rail_accessibility_score": float(row["rail_accessibility_score"]),
        }
    return gateway


def load_state_metrics() -> Dict[str, Dict[str, Any]]:
    pressure: Dict[str, float] = {}
    demand_raw: Dict[str, float] = {}
    receipts_raw: Dict[str, float] = {}
    for row in load_rows(PRESSURE_PATH):
        if row["year"] == TARGET_YEAR:
            pressure[to_state_key(row["state"])] = float(row["tourism_pressure_index"])
    for row in load_rows(TOURISM_PATH):
        if row["year"] == TARGET_YEAR:
            demand_raw[to_state_key(row["state"])] = float(row["tourists"])
            receipts_raw[to_state_key(row["state"])] = float(row["receipts_rm_million"])
    demand_norm = min_max_100(demand_raw)
    receipts_norm = min_max_100(receipts_raw)
    return {
        state: {
            "tourism_pressure_index": pressure.get(state, 50.0),
            "demand_potential": demand_norm.get(state, 50.0),
            "receipts_potential": receipts_norm.get(state, 50.0),
        }
        for state in set(list(pressure) + list(demand_norm) + list(receipts_norm))
    }


def load_rail_congestion() -> Dict[str, float]:
    """Per-station mean congestion 0-100. Reads rail_forecast.csv ONCE."""
    station_sum: Dict[str, Dict[str, float]] = {}
    for row in load_rows(RAIL_FORECAST_PATH):
        try:
            score = float(row["congestion_score"])
        except (KeyError, ValueError):
            continue
        for station in (row["origin_station"], row["destination_station"]):
            bucket = station_sum.setdefault(station.strip().lower(), {"sum": 0.0, "count": 0})
            bucket["sum"] += score
            bucket["count"] += 1
    return {
        station: bucket["sum"] / bucket["count"]
        for station, bucket in station_sum.items()
    }


def weighted_similarity_matrix(
    features: List[Dict[str, Any]], selected: List[str]
) -> np.ndarray:
    base = np.array(
        [[row["characteristics"][feature] for feature in CHARACTERISTICS] for row in features],
        dtype=float,
    )
    if selected:
        weights = np.array(
            [INTEREST_WEIGHT if feature in selected else OTHER_WEIGHT for feature in CHARACTERISTICS]
        )
        base = base * weights
    cosine = cosine_similarity(base)
    return np.clip(cosine * 100.0, 0.0, 100.0)


def economic_opportunity(state_metrics: Dict[str, float]) -> float:
    demand = state_metrics["demand_potential"]
    receipts = state_metrics["receipts_potential"]
    capacity = 100.0 - state_metrics["tourism_pressure_index"]
    return (
        ECONOMIC_WEIGHTS["demand"] * demand
        + ECONOMIC_WEIGHTS["receipts"] * receipts
        + ECONOMIC_WEIGHTS["capacity"] * capacity
    )


def sustainable_mobility(
    rail_accessibility: float, congestion: Optional[float]
) -> float:
    low_congestion = 100.0 - congestion if congestion is not None else 100.0
    return (
        MOBILITY_WEIGHTS["rail_accessibility"] * rail_accessibility
        + MOBILITY_WEIGHTS["low_congestion"] * low_congestion
    )


def matched_interests(candidate: Dict[str, Any]) -> List[str]:
    ranked = sorted(
        CHARACTERISTICS, key=lambda feature: candidate["characteristics"][feature], reverse=True
    )[:3]
    return [title_case(feature) for feature in ranked]


def build_explanation(source: str, candidate: str, sim: float, source_pressure: float,
                      candidate_pressure: float, eco: float, mobility: float,
                      rail_access: float, gateway: str, matched: List[str]) -> str:
    if sim >= 70:
        sim_phrase = "closely matches your interests"
    elif sim >= 45:
        sim_phrase = "partially matches your interests"
    else:
        sim_phrase = "offers a different experience profile"

    diff = candidate_pressure - source_pressure
    if diff <= -10:
        pressure_phrase = "considerably lower tourism pressure"
    elif diff < 0:
        pressure_phrase = "lower tourism pressure"
    elif diff <= 10:
        pressure_phrase = "comparable tourism pressure"
    else:
        pressure_phrase = "higher tourism pressure"

    if eco >= 60:
        eco_phrase = "strong economic headroom"
    elif eco >= 40:
        eco_phrase = "moderate economic headroom"
    else:
        eco_phrase = "limited economic headroom"

    if gateway and rail_access >= 70:
        mobility_phrase = f"offers good rail-based access via {gateway}"
    elif gateway and rail_access >= 35:
        mobility_phrase = f"is reachable via {gateway} with some last-mile travel"
    else:
        mobility_phrase = "has limited direct rail access (last-mile by road/air)"

    interests_text = ", ".join(matched) if matched else "your interests"
    return (
        f"{candidate} {sim_phrase} ({interests_text}, {sim:.0f}%). "
        f"Compared with {source}, it shows {pressure_phrase} and {eco_phrase}, "
        f"and {mobility_phrase}."
    )


def candidate_item(source_row: Dict[str, Any], candidate_row: Dict[str, Any],
                   sim_float: float, source_pressure: float,
                   gateway: Dict[str, Dict[str, Any]],
                   state_metrics: Dict[str, Dict[str, Any]],
                   rail_congestion: Dict[str, float]) -> Dict[str, Any]:
    """Evaluate ONE candidate against a source and return its recommendation."""
    g = gateway.get(candidate_row["destination"], {})
    station = g.get("gateway_station", "")
    rail_access = g.get("rail_accessibility_score", 0.0)
    congestion = rail_congestion.get(station.lower()) if station else None

    metrics = state_metrics.get(to_state_key(candidate_row["state"]), {})
    pressure = metrics.get("tourism_pressure_index", 50.0)
    lower_pressure = 100.0 - pressure
    eco = economic_opportunity(metrics)
    mobility = sustainable_mobility(rail_access, congestion)
    score = (
        SCORE_WEIGHTS["similarity"] * sim_float
        + SCORE_WEIGHTS["lower_pressure"] * lower_pressure
        + SCORE_WEIGHTS["economic_opportunity"] * eco
        + SCORE_WEIGHTS["sustainable_mobility"] * mobility
    )
    score = max(0.0, min(100.0, score))
    matched = matched_interests(candidate_row)
    explanation = build_explanation(
        source_row["destination"], candidate_row["destination"], sim_float,
        source_pressure, pressure, eco, mobility, rail_access, station, matched,
    )
    return {
        "sourceDestination": source_row["destination"],
        "destination": candidate_row["destination"],
        "state": candidate_row["state"],
        "score": round(score, 2),
        "similarity": round(sim_float, 2),
        "tourismPressure": round(pressure, 2),
        "lowerPressureScore": round(lower_pressure, 2),
        "economicOpportunity": round(eco, 2),
        "sustainableMobility": round(mobility, 2),
        "railAccessibility": round(rail_access, 2),
        "railCongestion": round(congestion, 2) if congestion is not None else "",
        "gatewayStation": station,
        "matchedInterests": matched,
        "explanation": explanation,
    }


def build_recommendations(top: int = 10) -> Dict[str, Any]:
    features = load_destination_features()
    gateway = load_gateway()
    state_metrics = load_state_metrics()
    rail_congestion = load_rail_congestion()

    selected: List[str] = []
    similarity = weighted_similarity_matrix(features, selected)

    recommendations: List[Dict[str, Any]] = []
    for i, source_row in enumerate(features):
        source_metrics = state_metrics.get(to_state_key(source_row["state"]), {})
        source_pressure = source_metrics.get("tourism_pressure_index", 50.0)
        ranked = sorted(
            (
                candidate_item(source_row, features[j], float(similarity[i][j]),
                               source_pressure, gateway, state_metrics, rail_congestion)
                for j in range(len(features))
                if j != i
            ),
            key=lambda item: (-item["score"], item["destination"]),
        )
        recommendations.extend(ranked[:top])

    without_rail = [row["destination"] for row in features if not gateway.get(row["destination"], {}).get("gateway_station")]
    return {
        "schema": "sustainable-diversion-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "prototypeNote": "Analytical prototype indicators (rail accessibility, congestion, economic opportunity) - NOT official statistics or KTMB classifications.",
            "tourismPressureLevel": "state-level tourism pressure index (2023)",
            "destinationCount": len(features),
            "gatewayMappingCount": len(gateway),
            "destinationsWithoutDirectRail": len(without_rail),
            "topPerDestination": top,
            "interests": selected,
            "interestWeight": INTEREST_WEIGHT,
            "scoreWeights": SCORE_WEIGHTS,
            "economicWeights": ECONOMIC_WEIGHTS,
            "mobilityWeights": MOBILITY_WEIGHTS,
        },
        "recommendations": recommendations,
    }


def print_top(source: str, interests: List[str], top: int = 5) -> None:
    features = load_destination_features()
    gateway = load_gateway()
    state_metrics = load_state_metrics()
    rail_congestion = load_rail_congestion()

    names = [row["destination"] for row in features]
    selected = interest_selection(interests)
    similarity = weighted_similarity_matrix(features, selected)
    if source not in names:
        print(f"  !! {source!r} not found")
        return
    i = names.index(source)
    source_row = features[i]
    source_pressure = state_metrics.get(to_state_key(source_row["state"]), {}).get("tourism_pressure_index", 50.0)

    print(f"  {source}  (interests: {selected or 'balanced'})")
    ranked = sorted(
        (
            candidate_item(source_row, features[j], float(similarity[i][j]),
                           source_pressure, gateway, state_metrics, rail_congestion)
            for j in range(len(features))
            if j != i
        ),
        key=lambda item: (-item["score"], item["destination"]),
    )
    for item in ranked[:top]:
        gateway_station = item["gatewayStation"] or "—"
        congestion = f"{item['railCongestion']:.1f}" if item["railCongestion"] != "" else ""
        print(f"    {item['destination']:<24} score={item['score']:5.2f}  "
              f"sim={item['similarity']:5.1f}%  gateway={gateway_station:<20} congestion={congestion}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interests", default="", help="comma-separated interests, e.g. Beach,Nature,Culture")
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--source", default="", help="print top matches for this source (no file write)")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    if args.source:
        print_top(args.source, [i for i in args.interests.split(",") if i], args.top)
        return 0

    data = build_recommendations(top=args.top)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    size_bytes = os.path.getsize(args.output)

    print("=" * 64)
    print("SMART DESTINATION AI — Sustainable Diversion Engine")
    print("=" * 64)
    print(f"destination count            : {data['metadata']['destinationCount']}")
    print(f"gateway mapping count        : {data['metadata']['gatewayMappingCount']}")
    print(f"destinations w/o direct rail : {data['metadata']['destinationsWithoutDirectRail']}")
    print(f"output                       : {args.output} ({size_bytes} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())