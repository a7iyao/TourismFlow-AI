#!/usr/bin/env python3
"""
Tourism Pressure Index — analytical scoring methodology
=======================================================

SMART DESTINATION AI — transparent tourism pressure scoring for the REAL
Layer 1 (tourism) + Layer 3 (population) dataset.

This is an analytical index, NOT a trained machine learning model. It combines
normalised component metrics into a continuous 0-100 tourism pressure score
using a fixed, documented weighting scheme. Every component score is kept in
the output so each result is fully explainable.

Component weights (sum = 100%)
-------------------------------
  30%  tourism_intensity            = visitors / resident_population
  20%  visitor_growth_pct           = year-on-year visitor growth
  20%  tourists                     = tourist arrivals
  15%  average_length_of_stay       = average nights per visit
  15%  receipts_per_resident_rm     = tourism receipts / resident_population

All components are normalised to 0-100 with min-max scaling applied WITHIN
each year (cross-sectional per-period), so states are compared with each other
in the same period without mixing absolute 2022/2023 levels.

Index = 0.30*norm(tourism_intensity)
      + 0.20*norm(visitor_growth_pct)
      + 0.20*norm(tourists)
      + 0.15*norm(average_length_of_stay)
      + 0.15*norm(receipts_per_resident_rm)

Pressure bands (documented cutpoints on the 0-100 scale)
--------------------------------------------------------
  0-39   LOW
  40-69  MODERATE
  70-100 HIGH

Accommodation pressure
----------------------
Hotel occupancy / inventory / room data is UNAVAILABLE for the current
pipeline, so NO accommodation component is included and no occupancy values
are fabricated. The pipeline is extensible: when accommodation data becomes
available, add an "occupancy_rate" entry to COMPONENTS below and the existing
per-row weight renormalisation in the build script activates it with no other
changes.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from dataio import parse_float

CLASSIFICATION_BANDS = (
    (0.0, 39.999, "LOW"),
    (40.0, 69.999, "MODERATE"),
    (70.0, 100.0, "HIGH"),
)

NEUTRAL_NORMALISED_VALUE = 50.0

# Component registry ---------------------------------------------------------
#   uses  -> read this raw column directly (ratio features such as
#            tourism_intensity and receipts_per_resident_rm are expected to be
#            pre-computed upstream in the Layer 1 + Layer 3 merged dataset).
#
# Adding a future component (e.g. occupancy_rate) is one registry entry; the
# build script renormalises the included weights automatically.
COMPONENTS: List[Dict[str, Any]] = [
    {
        "key": "tourism_intensity",
        "label": "Tourism Intensity",
        "weight": 0.30,
        "units": "visitors per resident",
        "uses": "tourism_intensity",
    },
    {
        "key": "visitor_growth_pct",
        "label": "Visitor Growth",
        "weight": 0.20,
        "units": "%",
        "uses": "visitor_growth_pct",
    },
    {
        "key": "tourists",
        "label": "Tourist Volume",
        "weight": 0.20,
        "units": "tourists",
        "uses": "tourists",
    },
    {
        "key": "average_length_of_stay",
        "label": "Average Length of Stay",
        "weight": 0.15,
        "units": "nights",
        "uses": "average_length_of_stay",
    },
    {
        "key": "receipts_per_resident_rm",
        "label": "Tourism Receipts per Resident",
        "weight": 0.15,
        "units": "RM per resident",
        "uses": "receipts_per_resident_rm",
    },
]


def classify(index: float) -> str:
    """Map a 0-100 index to LOW / MODERATE / HIGH."""
    for lower, upper, band in CLASSIFICATION_BANDS:
        if lower <= index <= upper:
            return band
    return "HIGH" if index > 100.0 else "LOW"


def raw_value(component: Dict[str, Any], row: Dict[str, Any]) -> Optional[float]:
    """Read the raw metric for a component, or None if data is missing.

    A component is unavailable when its input column is absent, empty, or
    unparsable. A missing value is never replaced with a fabricated number.
    """
    column = component.get("uses")
    if column is None:
        return None
    return parse_float(row.get(column))


def min_max_normalize(values: Sequence[Optional[float]]) -> Dict[int, Optional[float]]:
    """Normalise a series to 0-100 via min-max scaling.

    Missing values stay None. A constant series is assigned the neutral value
    (50) to avoid a divide-by-zero while staying transparent.
    """
    usable = [value for value in values if value is not None]
    if not usable:
        return {index: None for index in range(len(values))}
    low = min(usable)
    high = max(usable)
    if high == low:
        return {
            index: NEUTRAL_NORMALISED_VALUE
            for index, value in enumerate(values)
            if value is not None
        }
    span = high - low
    return {
        index: None if value is None else (value - low) / span * 100
        for index, value in enumerate(values)
    }