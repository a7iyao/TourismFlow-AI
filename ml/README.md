# SMART DESTINATION AI — ML / Data Workspace

Transparent tourism data pipeline for the Alternative Destination
Recommendation prototype. Everything here is **data processing and analytical
scoring** — none of it is a trained machine learning model.

## Directory layout

```
ml/
  data/
    raw/        original source files (provenance, incl. reference outputs)
    processed/  canonical datasets (tourism, population, merged L1+L3)
  scripts/      pipeline scripts + shared helpers
  models/       reserved for future clustering / ranking work
  output/       generated CSVs (features, population features, pressure)
```

## Pipeline

| Step | Script | Reads | Writes |
|---|---|---|---|
| L1 tourism dataset | (source `tourism_state_2022_2023.csv`) | — | `data/processed/tourism_state.csv` |
| L3 population dataset | (source `population_state_2022_2023.csv`) | — | `data/processed/population_state.csv` |
| L1+L3 merged | (source `tourism_population_merged_2022_2023.csv`) | — | `data/processed/tourism_population_merged.csv` |
| L1 features | `build_tourism_features.py` | `data/processed/tourism_state.csv` | `output/tourism_features.csv` |
| Population features | `build_population_features.py` | `data/processed/population_state.csv` | `output/population_features.csv` |
| Tourism Pressure Index | `build_tourism_pressure.py` | `data/processed/tourism_population_merged.csv` | `output/tourism_pressure.csv` |

```bash
python3 ml/scripts/build_population_features.py
python3 ml/scripts/build_tourism_pressure.py
```

## Tourism Pressure Index — methodology

Analytical index of tourism load, **not** a trained supervised model. Weighted
combination of normalised (0–100) components:

| Weight | Component | Source |
|---|---|---|
| 30% | Tourism Intensity | visitors / resident_population |
| 20% | Visitor Growth | visitor_growth_pct |
| 20% | Tourist Volume | tourists |
| 15% | Average Length of Stay | average_length_of_stay |
| 15% | Tourism Receipts per Resident | receipts_rm_million / resident_population |

Each component is normalised to 0–100 with **within-year min–max scaling**
(states are compared cross-sectionally in the same period, so 2022 and 2023 are
never mixed), then combined with the weights above. Raw values are preserved
beside the normalised component scores in `tourism_pressure.csv` for full
explainability.

Pressure bands (documented cutpoints on the 0–100 scale):

- **0–39 → LOW**
- **40–69 → MODERATE**
- **70–100 → HIGH**

Spots verified against the reference prototype `tourism_pressure_2023_prototype.csv`:
Melaka 2023 = 67.75 (MODERATE), Perlis 2023 = 14.30 (LOW), etc.

## Data availability and the current pipeline

The pipeline **does not fabricate missing data**.

- **Accommodation pressure is NOT included.** Hotel occupancy / inventory /
  room data is unavailable, so no `occupancy_rate` component is built and no
  values are invented.
- **Population (Layer 3) is now available** (`resident_population`), so
  Tourism Intensity and Receipts per Resident are active.
- The residential `population_growth_pct` for 2022 is intentionally blank (no
  2021 observation in the dataset); 2023 growth is computed.

## Adding accommodation later (no architecture change)

The component registry and per-row weight renormalisation live in
`ml/scripts/tourism_pressure.py` and `ml/scripts/build_tourism_pressure.py`.

1. Add an `occupancy_rate` column to `tourism_population_merged.csv`
   (state, year).
2. Register it as one entry in `COMPONENTS` (key, weight, `uses: "occupancy_rate"`).

The build script renormalises the included weights and activates the component
automatically; no further code or application changes are required.

## Transparency notes

- Data are real Layer 1 + Layer 3 sources kept in `data/raw/`; tourism rows
  document their origin per row via `source_file`, and the reference prototype
  is archived in `data/raw/`.
- The index is an analytical scoring model, not a trained ML prediction.
- Real datasets can replace the current sources in place; the registry and
  normalisation logic remain unchanged.