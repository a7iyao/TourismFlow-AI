#!/usr/bin/env python3
"""
train_rail_model.py
===================

SMART DESTINATION AI — Layer 4 rail ridership forecast prototype.

Reads  ml/output/rail_features.csv          (from build_rail_features.py)
Writes ml/output/rail_model_metrics.json
        ml/output/rail_forecast.csv

Pipeline stages 3-6 (from the datathon brief):

  Step 3  Supervised model on the engineered features.
          Regressor : HistGradientBoostingRegressor (scikit-learn), NaN-tolerant.
          Features  : service, origin_station, destination_station (native
                      categoricals, coded over TRAINING categories only),
                      hour, day_of_week, month, weekend, peak_hour,
                      route_load, origin_load, destination_load.
          Split     : STRICT time-based split — train <= 2026-08-31,
                      test >= 2026-09-01. No random train_test_split.
  Step 4  Report MAE, RMSE, R2 against a baseline of the historical
          route-hour average ridership. The model is kept only if it is
          reasonably better than that baseline.
  Step 5  Congestion classification from service-specific percentiles of the
          PREDICTED ridership:     <60th -> LOW, 60-85th -> MODERATE,
          >=85th -> HIGH. These are analytical prototype categories for this
          project, NOT official KTMB classifications.
  Step 6  Export a forecast table and a metrics JSON.

This is a transparent analytical prototype, not a product claim of a trained
"AI model".
"""

from __future__ import annotations

import json
import math
import os
import sys
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split  # noqa: F401  (banned here)

from dataio import load_rows, repo_root

OUTPUT_DIR = os.path.join(repo_root(), "ml", "output")
FEATURES_PATH = os.path.join(OUTPUT_DIR, "rail_features.csv")
FORECAST_PATH = os.path.join(OUTPUT_DIR, "rail_forecast.csv")
METRICS_PATH = os.path.join(OUTPUT_DIR, "rail_model_metrics.json")

TRAIN_END = "2026-08-31"

# Retention rule for the model vs the baseline (both MAE; lower is better):
# the model is retained only if it beats the baseline by at least this many
# percent. EXPOSED in the metrics JSON — never silently assumed. Default 0.0
# means "any improvement beats the baseline".
MIN_IMPROVEMENT_PERCENT = 0.0

NUMERIC_FEATURES = [
    "hour", "day_of_week", "month", "weekend", "peak_hour",
    "route_load", "origin_load", "destination_load",
]
CATEGORICAL_FEATURES = ["service", "origin_station", "destination_station"]

FORECAST_COLUMNS = [
    "date",
    "hour",
    "service",
    "origin_station",
    "destination_station",
    "predicted_ridership",
    "congestion_score",
    "congestion_level",
]


def build_coder(values: List[Any]) -> Dict[str, int]:
    """Map distinct values to dense integer codes; unseen -> <UNK> code."""
    categories = sorted({str(value) for value in values})
    code = {category: index for index, category in enumerate(categories)}
    code["<UNK>"] = len(categories)
    return code


def encode_categorical(row: Dict[str, Any], coder: Dict[str, int], name: str) -> int:
    return coder.get(str(row.get(name, "")), coder["<UNK>"])


def numeric_or_nan(row: Dict[str, Any], name: str) -> float:
    value = row.get(name)
    if value is None or value == "":
        return float("nan")
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def build_baseline(train_rows: List[Dict[str, Any]]):
    """Return a resolver of the historical route-hour average from training.

    Resolution order for any test route: exact (service, O, D, hour) mean, then
    (service, hour) mean, then the global training mean. Never NaN.
    """
    route_sum: Dict[tuple, List[float]] = {}
    for row in train_rows:
        route_sum.setdefault(
            (row["service"], row["origin_station"], row["destination_station"], row["hour"]),
            [],
        ).append(row["ridership"])
    route_means = {key: sum(values) / len(values) for key, values in route_sum.items()}

    service_hour_sum: Dict[tuple, List[float]] = {}
    for (service, _origin, _destination, hour), values in route_sum.items():
        service_hour_sum.setdefault((service, hour), []).extend(values)

    def resolve(service: str, origin: str, destination: str, hour: int) -> float:
        route = route_means.get((service, origin, destination, hour))
        if route is not None:
            return route
        service_hour = service_hour_sum.get((service, hour))
        if service_hour is not None:
            return sum(service_hour) / len(service_hour)
        return global_mean

    global_mean = sum(row["ridership"] for row in train_rows) / len(train_rows)
    return resolve


def congestion(service_values: Dict[str, List[float]]) -> Dict[str, Dict[str, float]]:
    """Return per-service congestion thresholds from PREDICTED values.

    Metadata keys are explicit about what each threshold is:
      p60_threshold                  60th percentile of predicted ridership
      p85_threshold                  85th percentile of predicted ridership
      maximum_predicted_ridership    max predicted ridership
    """
    boundaries: Dict[str, Dict[str, float]] = {}
    for service, values in service_values.items():
        if len(values) < 2:
            boundaries[service] = {
                "p60_threshold": float("nan"),
                "p85_threshold": float("nan"),
                "maximum_predicted_ridership": float("nan"),
            }
            continue
        p60 = np.percentile(values, 60)
        p85 = np.percentile(values, 85)
        boundaries[service] = {
            "p60_threshold": float(p60),
            "p85_threshold": float(p85),
            "maximum_predicted_ridership": float(np.max(values)),
        }
    return boundaries


def percentile_rank(values: List[float], value: float) -> float:
    """Empirical percentile 0-100 of value within values (<= count / n)."""
    if not values:
        return float("nan")
    rank = sum(1 for item in values if item <= value)
    return 100.0 * rank / len(values)


def classify(p60_threshold: float, p85_threshold: float, value: float) -> str:
    """Congestion category from predicted ridership.

    predicted <= p60_threshold          -> LOW
    p60_threshold < predicted <= p85    -> MODERATE
    predicted > p85_threshold           -> HIGH
    """
    if value <= p60_threshold:
        return "LOW"
    if value <= p85_threshold:
        return "MODERATE"
    return "HIGH"


def write_csv(path: str, columns: List[str], rows: List[Dict[str, Any]]) -> None:
    from csv import DictWriter

    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})


def parse_rows() -> List[Dict[str, Any]]:
    if not os.path.exists(FEATURES_PATH):
        print(f"ERROR: {FEATURES_PATH} not found — run build_rail_features.py first.",
              file=sys.stderr)
        sys.exit(1)
    rows = load_rows(FEATURES_PATH)
    for row in rows:
        row["hour"] = int(float(row["hour"]))
        row["day_of_week"] = int(float(row["day_of_week"]))
        row["month"] = int(float(row["month"]))
        row["weekend"] = int(float(row["weekend"]))
        row["peak_hour"] = int(float(row["peak_hour"]))
        row["ridership"] = float(row["ridership"])
    return rows


def main() -> int:
    print("=" * 60)
    print("SMART DESTINATION AI — Layer 4 rail forecast prototype")
    print("=" * 60)

    rows = parse_rows()
    train_rows = [row for row in rows if row["date"] <= TRAIN_END]
    test_rows = [row for row in rows if row["date"] > TRAIN_END]

    if not train_rows:
        print("ERROR: no training rows (data has no dates <= " + TRAIN_END + ").",
              file=sys.stderr)
        return 1
    if not test_rows:
        print("WARNING: no test rows (data has no dates after " + TRAIN_END + ").",
              file=sys.stderr)
        print("  Metrics and forecasts will be empty — cannot evaluate.")
        return 1

    print(f"train rows : {len(train_rows)}  ({min(r['date'] for r in train_rows)}..{max(r['date'] for r in train_rows)})")
    print(f"test rows  : {len(test_rows)}  ({min(r['date'] for r in test_rows)}..{max(r['date'] for r in test_rows)})")

    # --- categorical encoders fit on TRAINING categories only -------------
    coders = {
        name: build_coder([row[name] for row in train_rows])
        for name in CATEGORICAL_FEATURES
    }

    def design_matrix(dataset: List[Dict[str, Any]]) -> np.ndarray:
        columns: List[np.ndarray] = []
        for name in CATEGORICAL_FEATURES:
            columns.append(
                np.array([encode_categorical(row, coders[name], name) for row in dataset], dtype=np.int32)
            )
        for name in NUMERIC_FEATURES:
            columns.append(np.array([numeric_or_nan(row, name) for row in dataset]))
        return np.column_stack(columns)

    X_train = design_matrix(train_rows)
    X_test = design_matrix(test_rows)
    y_train = np.array([row["ridership"] for row in train_rows], dtype=float)
    y_test = np.array([row["ridership"] for row in test_rows], dtype=float)

    # --- model -------------------------------------------------------------
    model = HistGradientBoostingRegressor(
        max_iter=300,
        learning_rate=0.08,
        max_leaf_nodes=31,
        l2_regularization=0.1,
        random_state=42,
        categorical_features=[0, 1, 2],
    )
    model.fit(X_train, y_train)
    predicted = model.predict(X_test)

    # --- baseline ----------------------------------------------------------
    baseline = build_baseline(train_rows)
    baseline_pred = np.array(
        [
            baseline(row["service"], row["origin_station"], row["destination_station"], row["hour"])
            for row in test_rows
        ]
    )

    mae = float(mean_absolute_error(y_test, predicted))
    rmse = float(math.sqrt(mean_squared_error(y_test, predicted)))
    r2 = float(r2_score(y_test, predicted))
    baseline_mae = float(mean_absolute_error(y_test, baseline_pred))

    # MAE improvement over the baseline (lower is better).
    mae_improvement_absolute = baseline_mae - mae
    mae_improvement_percent = (mae_improvement_absolute / baseline_mae * 100.0) if baseline_mae else None

    # Retention rule, exposed explicitly (MIN_IMPROVEMENT_PERCENT, default 0.0):
    # the model is retained when its MAE beats the baseline MAE by at least
    # that percentage. With the default 0.0, any improvement counts.
    model_retained = (
        mae_improvement_percent is not None
        and mae_improvement_percent >= MIN_IMPROVEMENT_PERCENT
    )

    # --- congestion classification ---------------------------------------
    service_values: Dict[str, List[float]] = {}
    for row, value in zip(test_rows, predicted):
        service_values.setdefault(row["service"], []).append(float(value))
    boundaries = congestion(service_values)

    forecast_rows: List[Dict[str, Any]] = []
    for row, value in zip(test_rows, predicted):
        per_service = service_values[row["service"]]
        score = percentile_rank(per_service, float(value))
        boundaries_row = boundaries[row["service"]]
        level = classify(
            boundaries_row["p60_threshold"],
            boundaries_row["p85_threshold"],
            float(value),
        )
        forecast_rows.append(
            {
                "date": row["date"],
                "hour": row["hour"],
                "service": row["service"],
                "origin_station": row["origin_station"],
                "destination_station": row["destination_station"],
                "predicted_ridership": round(float(value), 3),
                "congestion_score": round(score, 3),
                "congestion_level": level,
            }
        )

    write_csv(FORECAST_PATH, FORECAST_COLUMNS, forecast_rows)

    metrics: Dict[str, Any] = {
        "model": "HistGradientBoostingRegressor (scikit-learn 1.6)",
        "analytical_category": "supervised regression prototype, strict time-based split, no random split",
        "train_period": [min(r["date"] for r in train_rows), TRAIN_END],
        "test_period": [min(r["date"] for r in test_rows), max(r["date"] for r in test_rows)],
        "train_rows": len(train_rows),
        "test_rows": len(test_rows),
        "features": CATEGORICAL_FEATURES + NUMERIC_FEATURES,
        "metrics": {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)},
        "baseline": {"name": "historical route-hour average", "mae": round(baseline_mae, 4)},
        "mae_improvement": {
            "absolute": round(mae_improvement_absolute, 4),
            "percent": round(mae_improvement_percent, 4) if mae_improvement_percent is not None else None,
        },
        "retention_rule": {
            "description": "model retained when MAE improvement over baseline >= min_improvement_percent",
            "min_improvement_percent": MIN_IMPROVEMENT_PERCENT,
        },
        "model_retained_against_baseline": model_retained,
        "congestion_bands": {
            "note": "service-specific percentiles of PREDICTED ridership; analytical prototype categories only, not official KTMB classifications",
            "classification": "predicted <= p60_threshold -> LOW; p60_threshold < predicted <= p85_threshold -> MODERATE; predicted > p85_threshold -> HIGH",
            "thresholds_by_service": {
                service: {k: round(v, 3) for k, v in boundaries_row.items()}
                for service, boundaries_row in boundaries.items()
            },
        },
        "public_holiday_feature": "unavailable: no reliable official Malaysian 2026 holiday calendar was supplied",
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2, ensure_ascii=False)

    # --- report -------------------------------------------------------------
    print("-" * 60)
    print("model MAE      : {:.3f}".format(mae))
    print("model RMSE     : {:.3f}".format(rmse))
    print("model R2       : {:.3f}".format(r2))
    print("baseline MAE   : {:.3f}  (historical route-hour average)".format(baseline_mae))
    improvement = "n/a" if mae_improvement_percent is None else "{:.3f}%".format(mae_improvement_percent)
    print("MAE improve    : absolute={:.3f}  percent={}".format(mae_improvement_absolute, improvement))
    print("retention rule : min_improvement_percent={:.1f}".format(MIN_IMPROVEMENT_PERCENT))
    print("model retained : {}".format(model_retained))
    print("-" * 60)
    print("10 example OD-hour forecasts:")
    print(f"  {'date':<10} {'hour':<4} {'service':<10} {'origin':<24} {'destination':<24} {'pred':>8} {'level'}")
    for row in forecast_rows[:10]:
        print(
            "  {date:<10} {hour:<4} {service:<10} {origin:<24} {destination:<24} {pred:>8} {level}".format(
                date=row["date"],
                hour=row["hour"],
                service=row["service"],
                origin=row["origin_station"][:24],
                destination=row["destination_station"][:24],
                pred=row["predicted_ridership"],
                level=row["congestion_level"],
            )
        )
    print("-" * 60)
    print(f"output: {FORECAST_PATH}")
    print(f"output: {METRICS_PATH}")
    print("NOTE: congestion bands are analytical prototype categories for this")
    print("      project, not official KTMB classifications.")
    return 0


if __name__ == "__main__":
    sys.exit(main())