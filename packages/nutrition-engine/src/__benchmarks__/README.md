# Nutrition Engine Benchmarks

Performance benchmarking suite for the `NutritionPipelineOrchestrator`.

## Quick Start

```bash
# Install dependencies (tsx is required)
pnpm install

# Run all benchmarks in mock mode (no API keys needed)
pnpm benchmark

# Generate a baseline snapshot
pnpm benchmark:baseline

# Compare current run against baseline
pnpm benchmark:compare src/__benchmarks__/baseline.json src/__benchmarks__/current.json
```

## Fixtures

| ID  | Description                         | Pipeline       | Key Code Paths                                                         |
| --- | ----------------------------------- | -------------- | ---------------------------------------------------------------------- |
| A   | Cut Male, 85kg, bodyFat 18%         | `run()` (full) | Katch-McArdle BMR, high_protein macro, caloric floor check             |
| B   | Maintain Female Vegan, 62kg         | `run()` (full) | Mifflin-St Jeor BMR, balanced macro, vegan filtering, allergy handling |
| C   | Bulk Pescatarian, 70kg, very active | `run()` (full) | Mifflin-St Jeor BMR, high training volume (5 days), 5 meals/day        |
| D   | Fast Path (reuse draft)             | `runFast()`    | Skips Agent 3 (RecipeCurator), recompiles with existing MealPlanDraft  |

## CLI Options

```
--fixtures=all|A|B|C|D    Comma-separated fixture IDs or "all" (default: all)
--iterations=N             Number of iterations per fixture (default: 3)
--output=path.json         Write results to JSON file (default: stdout only)
--mode=mock|real           mock = placeholder API keys; real = live APIs (default: mock)
--mock-delay=N             Artificial delay in ms for mock mode (default: 0)
```

## Modes

### Mock Mode (default)

Uses placeholder API keys, which cause the pipeline to fall through to:

- **RecipeCurator**: Deterministic meal generator (seeded PRNG, no Claude API call)
- **NutritionCompiler**: Local food database fallback (no FatSecret API call)
- **PdfRenderer**: Mocked to return a small buffer (no Chrome/Puppeteer)

Mock mode measures pure computation overhead: intake normalization, metabolic calculation, QA validation, HTML rendering, and the deterministic recipe path.

### Real Mode

Requires environment variables: `ANTHROPIC_API_KEY`, `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`. Measures end-to-end latency including API calls and PDF generation.

## Expected Timing Ranges

Ranges below are for **mock mode** on a modern development machine (Apple M-series or equivalent). Real-mode timings depend heavily on API latency.

### Per-Agent (Mock Mode)

| Agent                 | Mock Range | Notes                                         |
| --------------------- | ---------- | --------------------------------------------- |
| `intakeNormalizer`    | 0-2 ms     | Pure Zod validation + unit conversion         |
| `metabolicCalculator` | 0-2 ms     | BMR/TDEE/macro arithmetic                     |
| `recipeCurator`       | 5-50 ms    | Deterministic meal generator (no Claude call) |
| `nutritionCompiler`   | 10-100 ms  | Local food DB lookups, scaling                |
| `qaValidator`         | 1-10 ms    | Macro variance checks, scoring                |
| `brandRenderer`       | 5-50 ms    | HTML template rendering (PDF is mocked)       |

### Total Pipeline (Mock Mode)

| Fixture              | Expected Range | Notes                                            |
| -------------------- | -------------- | ------------------------------------------------ |
| A (Cut Male)         | 30-200 ms      | Full pipeline, 4 meals x 7 days                  |
| B (Maintain Vegan)   | 30-200 ms      | Full pipeline, 3 meals x 7 days + allergy filter |
| C (Bulk Pescatarian) | 40-250 ms      | Full pipeline, 5 meals x 7 days                  |
| D (Fast Path)        | 20-150 ms      | Skips Agent 3, fewer total operations            |

### Per-Agent (Real Mode)

| Agent                 | Real Range | Notes                                        |
| --------------------- | ---------- | -------------------------------------------- |
| `intakeNormalizer`    | 0-2 ms     | Same as mock (no external calls)             |
| `metabolicCalculator` | 0-2 ms     | Same as mock (no external calls)             |
| `recipeCurator`       | 15-60 s    | Claude API call (tool_use structured output) |
| `nutritionCompiler`   | 5-30 s     | FatSecret API calls per meal (with caching)  |
| `qaValidator`         | 1-10 ms    | Same as mock (no external calls)             |
| `brandRenderer`       | 1-10 s     | Puppeteer PDF generation with browser pool   |

## Cache Behavior

Each fixture runs twice per iteration:

1. **Cold cache**: Fresh `NutritionPipelineOrchestrator` instance (cleared FatSecret LRU caches)
2. **Warm cache**: Reuses the same instance from the cold run (LRU caches populated)

In real mode, warm-cache runs should show significantly lower `nutritionCompiler` times due to FatSecret cache hits.

## Comparison Tool

```bash
# Compare two benchmark snapshots
tsx src/__benchmarks__/compare.ts baseline.json current.json

# Custom regression threshold (default: 20%)
tsx src/__benchmarks__/compare.ts baseline.json current.json --threshold=15
```

Exit code 1 indicates a regression: any agent's mean time increased by more than the threshold percentage. This can be used in CI to gate merges.

## Output Format

The JSON output contains:

```jsonc
{
  "metadata": {
    "timestamp": "2026-02-17T...",
    "mode": "mock",
    "iterations": 3,
    "fixtures": ["A", "B", "C", "D"],
    "nodeVersion": "v22.x.x",
    "platform": "darwin",
  },
  "results": [
    {
      "fixtureId": "A",
      "fixtureLabel": "Cut Male (Katch-McArdle, high_protein, 4 meals)",
      "pipelineMode": "full",
      "samples": [
        {
          "iteration": 1,
          "cacheMode": "cold",
          "success": true,
          "totalTimeMs": 85,
          "agentTimingsMs": {
            "intakeNormalizer": 1,
            "metabolicCalculator": 0,
            "recipeCurator": 25,
            "nutritionCompiler": 40,
            "qaValidator": 2,
            "brandRenderer": 15,
          },
        },
        // ...
      ],
      "stats": {
        "totalTime": { "mean": 90, "p50": 88, "p95": 105, "min": 80, "max": 110, "count": 6 },
        "agents": {
          "intakeNormalizer": { "mean": 1, "p50": 1, "p95": 2, "min": 0, "max": 2, "count": 6 },
          // ...
        },
      },
    },
  ],
}
```
