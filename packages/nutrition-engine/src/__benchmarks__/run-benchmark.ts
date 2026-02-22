#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Nutrition Pipeline Benchmark Harness
 *
 * Runs the NutritionPipelineOrchestrator against predefined fixtures and
 * captures per-agent timing data, cache statistics, and aggregate stats.
 *
 * Usage:
 *   tsx src/__benchmarks__/run-benchmark.ts [options]
 *
 * Options:
 *   --fixtures=all|A|B|C|D    Comma-separated fixture IDs or "all" (default: all)
 *   --iterations=N             Number of iterations per fixture (default: 3)
 *   --output=path.json         Write results to JSON file (default: stdout only)
 *   --mode=mock|real           mock = placeholder API keys, mock PDF; real = live APIs (default: mock)
 *   --mock-delay=N             Artificial delay in ms for mock mode (default: 0)
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { FIXTURE_MAP, ALL_FIXTURE_IDS } from './fixtures';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';

// ============================================================
// CLI Argument Parsing
// ============================================================

interface BenchmarkArgs {
  fixtures: string[];
  iterations: number;
  output: string | null;
  mode: 'mock' | 'real';
  mockDelay: number;
}

function parseArgs(): BenchmarkArgs {
  const args = process.argv.slice(2);
  const parsed: BenchmarkArgs = {
    fixtures: [...ALL_FIXTURE_IDS],
    iterations: 3,
    output: null,
    mode: 'mock',
    mockDelay: 0,
  };

  for (const arg of args) {
    const [key, value] = arg.split('=');
    switch (key) {
      case '--fixtures':
        if (value === 'all') {
          parsed.fixtures = [...ALL_FIXTURE_IDS];
        } else {
          parsed.fixtures = value.split(',').map((s) => s.trim().toUpperCase());
        }
        break;
      case '--iterations':
        parsed.iterations = Math.max(1, parseInt(value, 10) || 3);
        break;
      case '--output':
        parsed.output = value;
        break;
      case '--mode':
        if (value === 'real' || value === 'mock') {
          parsed.mode = value;
        }
        break;
      case '--mock-delay':
        parsed.mockDelay = Math.max(0, parseInt(value, 10) || 0);
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
    }
  }

  // Validate fixture IDs
  for (const id of parsed.fixtures) {
    if (!FIXTURE_MAP[id]) {
      console.error(`Unknown fixture ID: "${id}". Valid IDs: ${ALL_FIXTURE_IDS.join(', ')}`);
      process.exit(1);
    }
  }

  return parsed;
}

function printUsage(): void {
  console.log(
    `
Nutrition Pipeline Benchmark Harness

Usage:
  tsx src/__benchmarks__/run-benchmark.ts [options]

Options:
  --fixtures=all|A|B|C|D    Comma-separated fixture IDs or "all" (default: all)
  --iterations=N             Number of iterations per fixture (default: 3)
  --output=path.json         Write results to JSON file (default: stdout only)
  --mode=mock|real           mock = placeholder API keys; real = live APIs (default: mock)
  --mock-delay=N             Artificial delay in ms for mock mode (default: 0)
  --help                     Show this help message
  `.trim()
  );
}

// ============================================================
// Console.log Interceptor (capture orchestrator timing JSON)
// ============================================================

interface CapturedTimings {
  timings: Record<string, number>;
  totalTime: number;
  timestamp: string;
}

class ConsoleCapture {
  private original: typeof console.log;
  private captured: CapturedTimings[] = [];

  constructor() {
    this.original = console.log;
  }

  start(): void {
    this.captured = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    console.log = function (...args: unknown[]) {
      // Try to parse JSON timing output from orchestrator (line 212/333)
      if (args.length === 1 && typeof args[0] === 'string') {
        try {
          const parsed = JSON.parse(args[0]);
          if (parsed.timings && typeof parsed.totalTime === 'number') {
            self.captured.push({
              timings: parsed.timings,
              totalTime: parsed.totalTime,
              timestamp: parsed.timestamp,
            });
            return; // Suppress pipeline timing logs from stdout
          }
        } catch {
          // Not JSON, pass through
        }
      }
      self.original.apply(console, args);
    };
  }

  stop(): void {
    console.log = this.original;
  }

  drain(): CapturedTimings[] {
    const result = [...this.captured];
    this.captured = [];
    return result;
  }
}

// ============================================================
// PDF Renderer Mock (avoids needing Chrome in mock mode)
// ============================================================

async function installPdfMock(delay: number): Promise<void> {
  // Dynamically mock the pdf-renderer module by overriding renderPdf
  // We replace the exported renderPdf function via the brand-renderer index
  try {
    const brandRenderer = await import('../agents/brand-renderer/index');
    const pdfRenderer = await import('../agents/brand-renderer/pdf-renderer');

    // Store original for potential restore
    const originalRenderPdf = pdfRenderer.renderPdf;

    // Override the module exports with a mock that returns a small buffer
    const mockPdf = async (_s: string, _g: string, _gr: string): Promise<Buffer> => {
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      return Buffer.from('%PDF-1.4 mock benchmark pdf');
    };

    // Use Object.defineProperty to override the module's exported function
    Object.defineProperty(pdfRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });

    // Also patch the re-export on brand-renderer index
    Object.defineProperty(brandRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });

    // Patch closeBrowserPool to be a no-op in mock mode
    Object.defineProperty(pdfRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });

    // Keep reference in case we need to restore
    (globalThis as Record<string, unknown>).__benchmarkOriginalRenderPdf = originalRenderPdf;
  } catch (err) {
    console.error('Warning: Failed to install PDF mock. PDF rendering may fail in mock mode.', err);
  }
}

// ============================================================
// Statistics Helpers
// ============================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function computeStats(values: number[]): {
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  count: number;
} {
  if (values.length === 0) {
    return { mean: 0, p50: 0, p95: 0, min: 0, max: 0, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    mean: Math.round(sum / sorted.length),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    count: sorted.length,
  };
}

// ============================================================
// Result Types
// ============================================================

interface RunSample {
  iteration: number;
  cacheMode: 'cold' | 'warm';
  success: boolean;
  totalTimeMs: number;
  agentTimingsMs: Record<string, number>;
  error?: string;
}

interface FixtureResult {
  fixtureId: string;
  fixtureLabel: string;
  pipelineMode: 'full' | 'fast';
  samples: RunSample[];
  stats: {
    totalTime: ReturnType<typeof computeStats>;
    agents: Record<string, ReturnType<typeof computeStats>>;
  };
}

interface BenchmarkReport {
  metadata: {
    timestamp: string;
    mode: 'mock' | 'real';
    iterations: number;
    fixtures: string[];
    nodeVersion: string;
    platform: string;
  };
  results: FixtureResult[];
}

// ============================================================
// Main Benchmark Runner
// ============================================================

async function runBenchmark(): Promise<void> {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('  Nutrition Pipeline Benchmark');
  console.log('='.repeat(60));
  console.log(`  Mode:        ${args.mode}`);
  console.log(`  Fixtures:    ${args.fixtures.join(', ')}`);
  console.log(`  Iterations:  ${args.iterations}`);
  console.log(`  Mock delay:  ${args.mockDelay}ms`);
  console.log(`  Output:      ${args.output ?? 'stdout only'}`);
  console.log('='.repeat(60));
  console.log('');

  // Install PDF mock in mock mode
  if (args.mode === 'mock') {
    await installPdfMock(args.mockDelay);
  }

  // Build pipeline config
  const config: PipelineConfig =
    args.mode === 'mock'
      ? {
          anthropicApiKey: 'sk-ant-placeholder-benchmark',
          usdaApiKey: 'placeholder-benchmark-usda-key',
          fatsecretClientId: 'placeholder-benchmark-id',
          fatsecretClientSecret: 'placeholder-benchmark-secret',
        }
      : {
          anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
          usdaApiKey: process.env.USDA_API_KEY || '',
          fatsecretClientId: process.env.FATSECRET_CLIENT_ID || undefined,
          fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || undefined,
        };

  const capture = new ConsoleCapture();
  const allResults: FixtureResult[] = [];

  for (const fixtureId of args.fixtures) {
    const fixture = FIXTURE_MAP[fixtureId];
    console.log(`--- Fixture ${fixture.id}: ${fixture.label} ---`);

    const samples: RunSample[] = [];

    for (let iter = 1; iter <= args.iterations; iter++) {
      // Run twice per iteration: cold cache then warm cache
      for (const cacheMode of ['cold', 'warm'] as const) {
        // For cold cache, create a fresh orchestrator to clear internal state
        const orchestrator = new NutritionPipelineOrchestrator(config);

        capture.start();

        let result: PipelineResult;
        const wallStart = Date.now();

        try {
          if (fixture.mode === 'fast' && fixture.draft) {
            result = await orchestrator.runFast({
              rawInput: fixture.input,
              existingDraft: fixture.draft,
            });
          } else {
            result = await orchestrator.run(fixture.input);
          }
        } catch (err) {
          result = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }

        const wallTime = Date.now() - wallStart;
        capture.stop();

        // Extract captured timing data from orchestrator's console.log
        const captured = capture.drain();
        const timingData = captured.length > 0 ? captured[captured.length - 1] : null;

        const sample: RunSample = {
          iteration: iter,
          cacheMode,
          success: result.success,
          totalTimeMs: timingData?.totalTime ?? wallTime,
          agentTimingsMs: timingData?.timings ?? {},
        };

        if (!result.success) {
          sample.error = result.error;
        }

        samples.push(sample);

        const status = result.success ? 'OK' : 'FAIL';
        const timeStr = sample.totalTimeMs.toLocaleString();
        console.log(
          `  [${status}] iter=${iter} cache=${cacheMode} total=${timeStr}ms` +
            (sample.error ? ` error="${sample.error}"` : '')
        );
      }
    }

    // Compute aggregate stats for this fixture
    const successSamples = samples.filter((s) => s.success);
    const totalTimes = successSamples.map((s) => s.totalTimeMs);

    // Collect all agent keys across samples
    const agentKeys = new Set<string>();
    for (const s of successSamples) {
      for (const key of Object.keys(s.agentTimingsMs)) {
        agentKeys.add(key);
      }
    }

    const agentStats: Record<string, ReturnType<typeof computeStats>> = {};
    for (const key of agentKeys) {
      const values = successSamples
        .map((s) => s.agentTimingsMs[key])
        .filter((v): v is number => v !== undefined);
      agentStats[key] = computeStats(values);
    }

    const fixtureResult: FixtureResult = {
      fixtureId: fixture.id,
      fixtureLabel: fixture.label,
      pipelineMode: fixture.mode,
      samples,
      stats: {
        totalTime: computeStats(totalTimes),
        agents: agentStats,
      },
    };

    allResults.push(fixtureResult);

    // Print summary for this fixture
    if (totalTimes.length > 0) {
      const stats = fixtureResult.stats.totalTime;
      console.log(
        `  Summary: mean=${stats.mean}ms p50=${stats.p50}ms p95=${stats.p95}ms ` +
          `min=${stats.min}ms max=${stats.max}ms (${stats.count} successful runs)`
      );
    } else {
      console.log('  Summary: No successful runs');
    }
    console.log('');
  }

  // Build final report
  const report: BenchmarkReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      mode: args.mode,
      iterations: args.iterations,
      fixtures: args.fixtures,
      nodeVersion: process.version,
      platform: process.platform,
    },
    results: allResults,
  };

  // Print final table
  printSummaryTable(allResults);

  // Write to file if requested
  if (args.output) {
    const outputPath = resolve(args.output);
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\nResults written to: ${outputPath}`);
  }

  // Clean up browser pool if not mocked
  if (args.mode === 'real') {
    try {
      const { closeBrowserPool } = await import('../agents/brand-renderer/pdf-renderer');
      await closeBrowserPool();
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================
// Summary Table Printer
// ============================================================

function printSummaryTable(results: FixtureResult[]): void {
  console.log('');
  console.log('='.repeat(80));
  console.log('  BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  const header = [
    'Fixture'.padEnd(12),
    'Mean'.padStart(8),
    'P50'.padStart(8),
    'P95'.padStart(8),
    'Min'.padStart(8),
    'Max'.padStart(8),
    'Runs'.padStart(6),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(80));

  for (const r of results) {
    const s = r.stats.totalTime;
    const row = [
      r.fixtureId.padEnd(12),
      `${s.mean}ms`.padStart(8),
      `${s.p50}ms`.padStart(8),
      `${s.p95}ms`.padStart(8),
      `${s.min}ms`.padStart(8),
      `${s.max}ms`.padStart(8),
      String(s.count).padStart(6),
    ].join(' | ');
    console.log(row);

    // Print per-agent breakdown
    for (const [agent, stats] of Object.entries(r.stats.agents)) {
      const agentRow = [
        `  ${agent}`.padEnd(12),
        `${stats.mean}ms`.padStart(8),
        `${stats.p50}ms`.padStart(8),
        `${stats.p95}ms`.padStart(8),
        `${stats.min}ms`.padStart(8),
        `${stats.max}ms`.padStart(8),
        String(stats.count).padStart(6),
      ].join(' | ');
      console.log(agentRow);
    }
  }

  console.log('='.repeat(80));
}

// ============================================================
// Entry Point
// ============================================================

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
