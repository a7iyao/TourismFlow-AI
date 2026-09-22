#!/usr/bin/env python3
"""
build_rail_features.py
======================

SMART DESTINATION AI — Layer 4 KTMB rail data -> unified OD feature table.

Reads  ml/data/raw/ets_2026.csv
        ml/data/raw/intercity_2026.csv
        ml/data/raw/komuter_2026.csv
        ml/data/raw/ridership_ktmb_daily.csv   (daily totals, reconciliation)
Writes ml/output/rail_od_unified.csv
        ml/output/rail_features.csv

Pipeline stage 1 (from the datathon brief):
  * combine the three service files into one OD schema
  * standardise service labels
  * drop invalid station values (Unknown, Penalty, ...)
  * validate ridership >= 0, origin/destination present, valid date/hour

Date parsing is EXPLICIT per source file (no format inference):
  ets_2026.csv       -> "%Y-%m-%d"   (ISO)
  intercity_2026.csv -> "%m/%d/%Y"   (month-first, e.g. 3/18/2026 = 18 Mar)
  komuter_2026.csv   -> "%Y-%m-%d"   (ISO)

The intercity file was audited: its dates are month-first (values such as
"3/18/2026" can only be 18 March). A day-first interpretation would silently
misread ambiguous rows and spill the test period into December.

Pipeline stage 2 (features, no future leakage):
  * day_of_week, weekday, weekend, month, day, peak_hour, route_id
  * origin_load / destination_load / route_load built ONLY from strictly
    earlier rows within the training window (never from future observations;
    early rows carry a missing value which the model can handle natively)
  * public_holiday: left EMPTY and documented as UNAVAILABLE because no
    reliable official Malaysian 2026 holiday calendar was supplied. Values are
    never fabricated here.

This is data processing, not a trained model.
"""

from __future__ import annotations

import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from dataio import load_rows, repo_root

RAW_DIR = os.path.join(repo_root(), "ml", "data", "raw")
OUTPUT_DIR = os.path.join(repo_root(), "ml", "output")

SERVICE_FILES = [
    ("ets_2026.csv", "ets"),
    ("intercity_2026.csv", "intercity"),
    ("komuter_2026.csv", "komuter"),
]
DAILY_FILE = "ridership_ktmb_daily.csv"

# Explicit source date formats — verified against the raw files:
#   ets/komuter are ISO %Y-%m-%d; intercity is MONTH-first %m/%d/%Y.
SOURCE_DATE_FORMATS = {
    "ets_2026.csv": "%Y-%m-%d",
    "intercity_2026.csv": "%m/%d/%Y",
    "komuter_2026.csv": "%Y-%m-%d",
}
DAILY_DATE_FORMAT = "%Y-%m-%d"

OD_UNIFIED_PATH = os.path.join(OUTPUT_DIR, "rail_od_unified.csv")
FEATURES_PATH = os.path.join(OUTPUT_DIR, "rail_features.csv")

DATE_ALIASES = [
    "date", "trip_date", "tripdate", "service_date", "day", "travel_date",
]
HOUR_ALIASES = [
    "hour", "hr", "departure_hour", "arrival_hour", "start_hour", "time",
    "departure_time",
]
ORIGIN_ALIASES = [
    "origin", "origin_station", "from", "from_station", "boarding_station",
    "origin_station_name",
]
DEST_ALIASES = [
    "destination", "destination_station", "to", "to_station", "alighting_station",
    "destination_station_name",
]
RIDERSHIP_ALIASES = [
    "ridership", "passengers", "passenger", "volume", "demand", "trip_count",
    "count", "pax", "pax_count",
]
SERVICE_ALIASES = ["service", "service_type", "route"]

INVALID_STATION_VALUES = {
    "unknown", "penalty", "", "n/a", "na", "tbd", "-", "none", "null",
    "not available",
}

FEATURE_COLUMNS = [
    "date",
    "hour",
    "service",
    "origin_station",
    "destination_station",
    "ridership",
    "day_of_week",
    "weekday",
    "weekend",
    "month",
    "day",
    "peak_hour",
    "route_id",
    "origin_load",
    "destination_load",
    "route_load",
    "public_holiday",
]

# Time-based split boundary used to define "historic/training information".
TRAIN_END = "2026-08-31"


def detect_column(headers: List[str], aliases: List[str]) -> Optional[str]:
    lowered = [header.strip().lower() for header in headers]
    for alias in aliases:
        if alias in lowered:
            return headers[lowered.index(alias)]
    return None


def parse_date_exact(value: Any, fmt: str) -> Optional[str]:
    """Parse a date cell strictly with the given strptime format.

    No inference: the caller always provides the verified source format
    (see SOURCE_DATE_FORMATS). Returns YYYY-MM-DD, or None when the cell is
    blank / not a valid date in that format.
    """
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return datetime.strptime(text, fmt).date().isoformat()
    except ValueError:
        return None


def audit_dates(path: str, fmt: str) -> Dict[str, Any]:
    """Scan a raw file's first/labeled date column for a date-format audit.

    Reports raw minimum/maximum date STRINGS (as written by the source) and
    the corresponding parsed minimum/maximum dates after explicit parsing,
    plus the count of dates that fail to parse.
    """
    rows = load_rows(path)
    if not rows:
        return {"invalid": 0}
    col_date = detect_column(list(rows[0].keys()), DATE_ALIASES) or list(rows[0].keys())[0]
    raw_min = raw_max = None
    parsed_min = parsed_max = None
    invalid = 0
    for row in rows:
        text = str(row.get(col_date, "")).strip()
        if text:
            if raw_min is None or text < raw_min:
                raw_min = text
            if raw_max is None or text > raw_max:
                raw_max = text
        parsed = parse_date_exact(text, fmt)
        if parsed is None:
            invalid += 1
        else:
            if parsed_min is None or parsed < parsed_min:
                parsed_min = parsed
            if parsed_max is None or parsed > parsed_max:
                parsed_max = parsed
    return {
        "raw_min": raw_min,
        "raw_max": raw_max,
        "parsed_min": parsed_min,
        "parsed_max": parsed_max,
        "invalid_dates": invalid,
    }


def parse_hour(value: Any) -> Optional[int]:
    """Parse an hour cell (0-23), else None. UTC-like 24:00 is clamped to 0."""
    if value is None:
        return None
    text = str(value).strip().lower()
    if text == "":
        return None
    try:
        hour = int(float(text))
        if hour == 24:
            hour = 0
        return hour if 0 <= hour <= 23 else None
    except (ValueError, TypeError):
        pass
    match = re.search(r"(\d{1,2})[:.](\d{2})", text)
    if match:
        hour = int(match.group(1))
        minutes = int(match.group(2))
        if 0 <= hour <= 23 and 0 <= minutes <= 59:
            return hour
        return None
    match = re.search(r"(\d{1,2})\s*(am|pm)", text)
    if match:
        hour = int(match.group(1))
        ampm = match.group(2)
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        return hour if 0 <= hour <= 23 else None
    return None


def standardize_station(value: Any) -> Optional[str]:
    """Return a cleaned station name, or None if it is invalid/blank."""
    if value is None:
        return None
    station = str(value).strip()
    if station.lower() in INVALID_STATION_VALUES:
        return None
    return station


def load_od_rows(path: str, default_service: str, date_format: str) -> List[Dict[str, Any]]:
    """Load one KTMB service file into canonical OD rows (not yet aggregated).

    Dates are parsed EXPLICITLY with date_format (the verified source format).
    """
    rows = load_rows(path)
    if not rows:
        return []
    headers = list(rows[0].keys())

    col_date = detect_column(headers, DATE_ALIASES)
    col_hour = detect_column(headers, HOUR_ALIASES)
    col_origin = detect_column(headers, ORIGIN_ALIASES)
    col_dest = detect_column(headers, DEST_ALIASES)
    col_ridership = detect_column(headers, RIDERSHIP_ALIASES)
    col_service = detect_column(headers, SERVICE_ALIASES)

    missing = [
        name
        for name, col in (
            ("date", col_date),
            ("hour", col_hour),
            ("origin", col_origin),
            ("destination", col_dest),
            ("ridership", col_ridership),
        )
        if col is None
    ]
    if missing:
        raise ValueError(f"{os.path.basename(path)}: missing column(s): {missing}")

    output: List[Dict[str, Any]] = []
    for row in rows:
        date = parse_date_exact(row.get(col_date), date_format)
        hour = parse_hour(row.get(col_hour))
        origin = standardize_station(row.get(col_origin))
        destination = standardize_station(row.get(col_dest))
        ridership = _parse_non_negative(row.get(col_ridership))

        service = default_service
        if col_service is not None:
            candidate = str(row.get(col_service, "")).strip().lower()
            if candidate in ("ets", "intercity", "komuter"):
                service = candidate

        if (
            date is None
            or hour is None
            or origin is None
            or destination is None
            or ridership is None
        ):
            continue  # invalid row dropped (counted by the caller)

        output.append(
            {
                "date": date,
                "hour": hour,
                "service": service,
                "origin_station": origin,
                "destination_station": destination,
                "ridership": ridership,
            }
        )
    return output


def _parse_non_negative(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        number = float(str(value).strip())
    except (ValueError, TypeError):
        return None
    if number < 0 or number != number:  # reject negatives and NaN
        return None
    return number


def aggregate_duplicates(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sum ridership for exact duplicate (date, hour, service, O-D) rows."""
    combined: Dict[tuple, Dict[str, Any]] = {}
    for row in rows:
        key = (
            row["date"], row["hour"], row["service"],
            row["origin_station"], row["destination_station"],
        )
        if key in combined:
            combined[key]["ridership"] += row["ridership"]
        else:
            combined[key] = dict(row)
    return sorted(
        combined.values(),
        key=lambda row: (
            row["date"], row["hour"], row["service"],
            row["origin_station"], row["destination_station"],
        ),
    )


def is_peak_hour(hour: int) -> int:
    """1 for typical commuting peaks (07-09 and 17-19), else 0."""
    return 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0


def add_historical_loads(rows: List[Dict[str, Any]]) -> None:
    """Mutate rows in place adding origin/destination/route load features.

    For each row the features reflect only strictly earlier rows observed
    during the training window (date <= TRAIN_END). Rows inside the test period
    contribute nothing, and no future observation is ever used. Rows without a
    history keep a missing value (the HGB model handles NaN natively).
    """
    counters: Dict[str, List[float]] = defaultdict(list)

    def mean_for(key: str) -> Optional[float]:
        entries = counters[key]
        if not entries:
            return None
        return sum(entries) / len(entries)

    for row in rows:
        row["origin_load"] = mean_for("origin:" + row["origin_station"])
        row["destination_load"] = mean_for("destination:" + row["destination_station"])
        row["route_load"] = mean_for("route:" + row["service"] + ":" + row["origin_station"] + ":" + row["destination_station"])
        if row["date"] <= TRAIN_END:
            counters["origin:" + row["origin_station"]].append(row["ridership"])
            counters["destination:" + row["destination_station"]].append(row["ridership"])
            route_key = "route:" + row["service"] + ":" + row["origin_station"] + ":" + row["destination_station"]
            counters[route_key].append(row["ridership"])


def reconcile_daily(input_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compare OD-level daily totals against the KTMB daily ridership file.

    Returns a small reconciliation summary used for transparency only; it does
    not alter any features or predictions.
    """
    daily_path = os.path.join(RAW_DIR, DAILY_FILE)
    if not os.path.exists(daily_path):
        return {"dates_in_daily_file": 0, "dates_in_od": 0, "matched": 0, "note": "daily file missing"}

    daily_totals: Dict[str, float] = defaultdict(float)
    for row in load_rows(daily_path):
        headers = list(row.keys())
        col_date = detect_column(headers, DATE_ALIASES) or headers[0]
        col_ridership = detect_column(headers, RIDERSHIP_ALIASES)
        date = parse_date_exact(row.get(col_date), DAILY_DATE_FORMAT)
        value = _parse_non_negative(row.get(col_ridership)) if col_ridership else None
        if date is not None and value is not None:
            daily_totals[date] += value

    od_totals: Dict[str, float] = defaultdict(float)
    for row in input_rows:
        od_totals[row["date"]] += row["ridership"]

    matched = [date for date in daily_totals if date in od_totals]
    max_diff = 0.0
    for date in matched:
        if od_totals[date] > 0:
            max_diff = max(max_diff, abs(od_totals[date] - daily_totals[date]) / od_totals[date])

    return {
        "dates_in_daily_file": len(daily_totals),
        "dates_in_od": len(od_totals),
        "matched": len(matched),
        "max_relative_diff": round(max_diff, 4),
    }


def write_csv(path: str, columns: List[str], rows: List[Dict[str, Any]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as handle:
        from csv import DictWriter

        writer = DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})


def main() -> int:
    missing_files = [
        name for name, _ in SERVICE_FILES
        if not os.path.exists(os.path.join(RAW_DIR, name))
    ]
    if missing_files:
        print(
            "ERROR: missing rail input file(s): " + ", ".join(missing_files),
            file=sys.stderr,
        )
        print(f"  Expected in: {RAW_DIR}", file=sys.stderr)
        return 1

    all_rows: List[Dict[str, Any]] = []
    per_service: Dict[str, List[Dict[str, Any]]] = {}
    dropped = 0
    date_audits: Dict[str, Dict[str, Any]] = {}
    for filename, service in SERVICE_FILES:
        path = os.path.join(RAW_DIR, filename)
        source_format = SOURCE_DATE_FORMATS[filename]
        date_audits[filename] = audit_dates(path, source_format)
        try:
            raw_rows = load_od_rows(path, service, source_format)
        except ValueError as error:
            print(f"ERROR: {error}", file=sys.stderr)
            return 1
        dropped += len(load_rows(path)) - len(raw_rows)
        service_rows = aggregate_duplicates(raw_rows)
        per_service[service] = service_rows
        all_rows.extend(service_rows)

    all_rows = sorted(
        all_rows,
        key=lambda row: (
            row["date"], row["hour"], row["service"],
            row["origin_station"], row["destination_station"],
        ),
    )

    # --- features ----------------------------------------------------------
    for row in all_rows:
        parsed_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
        row["day_of_week"] = parsed_date.weekday()          # 0=Mon .. 6=Sun
        row["weekday"] = 1 if parsed_date.weekday() < 5 else 0
        row["weekend"] = 1 if parsed_date.weekday() >= 5 else 0
        row["month"] = parsed_date.month
        row["day"] = parsed_date.day
        row["peak_hour"] = is_peak_hour(row["hour"])
        row["route_id"] = (
            f"{row['service']}:{row['origin_station']}:{row['destination_station']}"
        )
        row["public_holiday"] = ""  # unavailable - no reliable MY 2026 calendar

    add_historical_loads(all_rows)

    od_export = [
        {key: row[key] for key in [
            "date", "hour", "service", "origin_station",
            "destination_station", "ridership",
        ]}
        for row in all_rows
    ]
    write_csv(OD_UNIFIED_PATH, list(od_export[0].keys()), od_export)
    write_csv(FEATURES_PATH, FEATURE_COLUMNS, all_rows)

    reconciliation = reconcile_daily(all_rows)

    # --- summary -----------------------------------------------------------
    station_counts: Dict[str, int] = {}
    for service, service_rows in per_service.items():
        stations = {row["origin_station"] for row in service_rows}
        stations.update(row["destination_station"] for row in service_rows)
        station_counts[service] = len(stations)

    dates = sorted({row["date"] for row in all_rows})
    print("=" * 60)
    print("SMART DESTINATION AI — Layer 4 rail features")
    print("=" * 60)
    print("date audit (explicit source formats):")
    for filename, _ in SERVICE_FILES:
        audit = date_audits[filename]
        print(f"  {filename}  format={SOURCE_DATE_FORMATS[filename]}")
        print(f"    raw_min={audit['raw_min']!r} raw_max={audit['raw_max']!r}")
        print(f"    parsed_min={audit['parsed_min']} parsed_max={audit['parsed_max']} invalid_dates={audit['invalid_dates']}")
    print("-" * 60)
    print(f"rows after cleaning & dedup : {len(all_rows)}")
    print(f"rows dropped as invalid     : {dropped} (source rows before dedup)")
    print(f"date range                  : {dates[0] if dates else '—'} to {dates[-1] if dates else '—'}")
    print("-" * 60)
    print("stations by service:")
    for service, service_rows in per_service.items():
        print(f"  {service:<12} rows={len(service_rows):>6}  stations={station_counts[service]}")
    print("-" * 60)
    print("daily reconciliation (OD vs ridership_ktmb_daily.csv):")
    for key, value in reconciliation.items():
        print(f"  {key}: {value}")
    print("-" * 60)
    print(f"output: {OD_UNIFIED_PATH}")
    print(f"output: {FEATURES_PATH}")
    print("NOTE: public_holiday is EMPTY (no reliable Malaysian 2026 holiday")
    print("      calendar supplied). No holiday values were fabricated.")
    print("NOTE: historical loads (origin/destination/route) use strictly")
    print("      earlier training rows only — no future leakage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())