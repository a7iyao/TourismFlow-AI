#!/usr/bin/env python3
"""
Shared input/output helpers for the ml/ pipeline (stdlib only).

Kept dependency-free so the data workspace runs on a plain Python 3 install.
"""

from __future__ import annotations

import csv
import os
from typing import Dict, List, Optional


def repo_root() -> str:
    """Absolute path to the repository root (the parent of ml/)."""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_rows(path: str) -> List[Dict[str, str]]:
    """Read a CSV into a list of row dicts."""
    with open(path, "r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def parse_float(value: Optional[str]) -> Optional[float]:
    """Parse a raw cell into a float.

    Returns None for empty cells or values that cannot be parsed so callers can
    report them instead of silently fabricating a number.
    """
    if value is None:
        return None
    stripped = value.strip()
    if stripped == "":
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def format_number(value: float) -> str:
    """Write small/large floats without ugly CSV artifacts."""
    if float(value).is_integer():
        return str(int(value))
    return ("%.8f" % value).rstrip("0").rstrip(".")


def is_usable_number(value: Optional[str]) -> bool:
    """True when a raw cell parses to a usable number."""
    return parse_float(value) is not None