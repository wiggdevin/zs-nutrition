#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Benchmark Comparison Tool
 *
 * Reads two benchmark JSON files (baseline vs current) and computes
 * per-metric percentage change. Flags regressions (>20% increase in
 * any agent's mean time) and exits with code 1 if any are found.
 *
 * Usage:
 *   tsx src/__benchmarks__/compare.ts <baseline.json> <current.json>
 *
 * Options:
 *   --threshold=N    Regression threshold percentage (default: 20)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Types (matching run-benchmark.ts output)
// ============================================================

interface StatsSummary {
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  count: number;
}

interface FixtureResult {
  fixtureId: string;
  fixtureLabel: string;
  pipelineMode: string;
  stats: {
    totalTime: StatsSummary;
    agents: Record<string, StatsSummary>;
  };
}

interface BenchmarkReport {
  metadata: {
    timestamp: string;
    mode: string;
    iterations: number;
    fixtures: string[];
    nodeVersion: string;
    platform: string;
  };
  results: FixtureResult[];
}

// ============================================================
// CLI Parsing
// ============================================================

function parseArgs(): { baselinePath: string; currentPath: string; threshold: number } {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  let threshold = 20;

  for (const arg of args) {
    if (arg.startsWith('--threshold=')) {
      threshold = Math.max(1, parseInt(arg.split('=')[1], 10) || 20);
    } else if (arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error('Error: Two benchmark JSON files required.\n');
    printUsage();
    process.exit(1);
  }

  return {
    baselinePath: resolve(positional[0]),
    currentPath: resolve(positional[1]),
    threshold,
  };
}

function printUsage(): void {
  console.log(
    `
Benchmark Comparison Tool

Usage:
  tsx src/__benchmarks__/compare.ts <baseline.json> <current.json>

Options:
  --threshold=N    Regression threshold percentage (default: 20)
  --help           Show this help message

Exit codes:
  0  No regressions detected
  1  One or more metrics regressed beyond threshold
  `.trim()
  );
}

// ============================================================
// Comparison Logic
// ============================================================

interface ComparisonRow {
  fixture: string;
  metric: string;
  baselineMs: number;
  currentMs: number;
  changeMs: number;
  changePct: number;
  isRegression: boolean;
}

function computeChange(baseline: number, current: number): { changeMs: number; changePct: number } {
  const changeMs = current - baseline;
  const changePct = baseline > 0 ? (changeMs / baseline) * 100 : current > 0 ? 100 : 0;
  return { changeMs, changePct };
}

function compareResults(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  threshold: number
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  // Build lookup maps
  const baselineByFixture = new Map<string, FixtureResult>();
  for (const r of baseline.results) {
    baselineByFixture.set(r.fixtureId, r);
  }

  for (const curr of current.results) {
    const base = baselineByFixture.get(curr.fixtureId);
    if (!base) {
      // New fixture in current, no comparison possible
      rows.push({
        fixture: curr.fixtureId,
        metric: 'totalTime (mean)',
        baselineMs: 0,
        currentMs: curr.stats.totalTime.mean,
        changeMs: curr.stats.totalTime.mean,
        changePct: 100,
        isRegression: false, // Can't regress from nothing
      });
      continue;
    }

    // Compare total time
    for (const stat of ['mean', 'p50', 'p95'] as const) {
      const bVal = base.stats.totalTime[stat];
      const cVal = curr.stats.totalTime[stat];
      const { changeMs, changePct } = computeChange(bVal, cVal);

      rows.push({
        fixture: curr.fixtureId,
        metric: `totalTime (${stat})`,
        baselineMs: bVal,
        currentMs: cVal,
        changeMs,
        changePct,
        isRegression: changePct > threshold,
      });
    }

    // Compare per-agent mean times
    const allAgentKeys = new Set([
      ...Object.keys(base.stats.agents),
      ...Object.keys(curr.stats.agents),
    ]);

    for (const agent of allAgentKeys) {
      const bMean = base.stats.agents[agent]?.mean ?? 0;
      const cMean = curr.stats.agents[agent]?.mean ?? 0;
      const { changeMs, changePct } = computeChange(bMean, cMean);

      rows.push({
        fixture: curr.fixtureId,
        metric: `${agent} (mean)`,
        baselineMs: bMean,
        currentMs: cMean,
        changeMs,
        changePct,
        isRegression: bMean > 0 && changePct > threshold,
      });
    }
  }

  return rows;
}

// ============================================================
// Table Formatting
// ============================================================

function formatTable(rows: ComparisonRow[]): void {
  const COL_WIDTHS = {
    fixture: 10,
    metric: 28,
    baseline: 10,
    current: 10,
    change: 10,
    pct: 10,
    status: 8,
  };

  const header = [
    'Fixture'.padEnd(COL_WIDTHS.fixture),
    'Metric'.padEnd(COL_WIDTHS.metric),
    'Baseline'.padStart(COL_WIDTHS.baseline),
    'Current'.padStart(COL_WIDTHS.current),
    'Change'.padStart(COL_WIDTHS.change),
    '%'.padStart(COL_WIDTHS.pct),
    'Status'.padEnd(COL_WIDTHS.status),
  ].join(' | ');

  const separator = '-'.repeat(header.length);

  console.log('');
  console.log('='.repeat(header.length));
  console.log('  BENCHMARK COMPARISON');
  console.log('='.repeat(header.length));
  console.log(header);
  console.log(separator);

  let currentFixture = '';

  for (const row of rows) {
    // Visual separator between fixtures
    if (row.fixture !== currentFixture) {
      if (currentFixture !== '') {
        console.log(separator);
      }
      currentFixture = row.fixture;
    }

    const sign = row.changeMs >= 0 ? '+' : '';
    const pctSign = row.changePct >= 0 ? '+' : '';
    const status = row.isRegression ? 'REGR' : 'OK';

    const line = [
      row.fixture.padEnd(COL_WIDTHS.fixture),
      row.metric.padEnd(COL_WIDTHS.metric),
      `${row.baselineMs}ms`.padStart(COL_WIDTHS.baseline),
      `${row.currentMs}ms`.padStart(COL_WIDTHS.current),
      `${sign}${row.changeMs}ms`.padStart(COL_WIDTHS.change),
      `${pctSign}${row.changePct.toFixed(1)}%`.padStart(COL_WIDTHS.pct),
      status.padEnd(COL_WIDTHS.status),
    ].join(' | ');

    console.log(line);
  }

  console.log('='.repeat(header.length));
}

// ============================================================
// Main
// ============================================================

function main(): void {
  const { baselinePath, currentPath, threshold } = parseArgs();

  let baselineData: BenchmarkReport;
  let currentData: BenchmarkReport;

  try {
    baselineData = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read baseline file: ${baselinePath}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    currentData = JSON.parse(readFileSync(currentPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read current file: ${currentPath}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`Baseline: ${baselinePath}`);
  console.log(`  recorded: ${baselineData.metadata.timestamp}`);
  console.log(
    `  mode: ${baselineData.metadata.mode}, iterations: ${baselineData.metadata.iterations}`
  );
  console.log(`Current:  ${currentPath}`);
  console.log(`  recorded: ${currentData.metadata.timestamp}`);
  console.log(
    `  mode: ${currentData.metadata.mode}, iterations: ${currentData.metadata.iterations}`
  );
  console.log(`Threshold: ${threshold}%`);

  const rows = compareResults(baselineData, currentData, threshold);
  formatTable(rows);

  const regressions = rows.filter((r) => r.isRegression);

  if (regressions.length > 0) {
    console.log(
      `\nREGRESSIONS DETECTED: ${regressions.length} metric(s) exceeded ${threshold}% threshold`
    );
    for (const r of regressions) {
      console.log(
        `  - Fixture ${r.fixture} / ${r.metric}: ${r.baselineMs}ms -> ${r.currentMs}ms (+${r.changePct.toFixed(1)}%)`
      );
    }
    process.exit(1);
  } else {
    console.log(`\nNo regressions detected (threshold: ${threshold}%)`);
    process.exit(0);
  }
}

main();
