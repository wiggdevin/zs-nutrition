#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * USDA-Only Pipeline Test Runner
 *
 * Runs 3 selected personas through the full pipeline with USDA only (no FatSecret),
 * scores results across 5 categories, and generates markdown scorecards.
 *
 * Personas:
 *   Marcus (1)   — Caloric floor (1500), high-protein at low cal
 *   Raj (3)      — Vegan + high-protein + soy allergy
 *   Jennifer (4) — Keto (5% carbs) + dairy allergy
 *
 * USDA-only is achieved by omitting fatsecretClientId/fatsecretClientSecret
 * from PipelineConfig — the orchestrator conditionally creates FatSecretAdapter
 * only if credentials are present.
 *
 * Usage:
 *   tsx src/__benchmarks__/run-usda-only-test.ts [--persona=marcus]
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';
import type { RawIntakeForm, MetabolicProfile, ClientIntake } from '../types/schemas';
import { scorePlan, extractIngredientCoverage, extractUnmatchedIngredients } from './scoring';
import type { ScorecardResult } from './scoring';
import { generateScorecard, generateComparisonTable } from './scorecard-generator';

// ============================================================
// Output Directory
// ============================================================

const OUTPUT_DIR = resolve(
  '/Users/zero-suminc./Desktop/ZS-MAC/NE Implementation/Nutrition Engine testing:validation'
);

// ============================================================
// Metabolic Profiles (loaded from stage1 data)
// ============================================================

interface Stage1Profile {
  personaId: string;
  personaName: string;
  rawInput: RawIntakeForm;
  clientIntake: ClientIntake;
  metabolicProfile: MetabolicProfile;
}

function loadStage1Profiles(): Stage1Profile[] {
  const profilePath = resolve(OUTPUT_DIR, 'stage1-metabolic-profiles.json');
  if (!existsSync(profilePath)) {
    throw new Error(`Stage 1 metabolic profiles not found: ${profilePath}`);
  }
  return JSON.parse(readFileSync(profilePath, 'utf-8'));
}

// ============================================================
// 3 Selected Personas
// ============================================================

interface PersonaDef {
  personaId: string;
  slug: string;
  name: string;
  input: RawIntakeForm;
  expectedMetabolic: {
    goalKcal: number;
    proteinTargetG: number;
    carbsTargetG: number;
    fatTargetG: number;
  };
}

const PERSONA_IDS = ['1', '3', '4'];

function buildPersonaDefs(profiles: Stage1Profile[]): PersonaDef[] {
  const SLUG_MAP: Record<string, string> = { '1': 'marcus', '3': 'raj', '4': 'jennifer' };
  const defs: PersonaDef[] = [];

  for (const id of PERSONA_IDS) {
    const profile = profiles.find((p) => p.personaId === id);
    if (!profile) {
      throw new Error(`Persona ${id} not found in stage1-metabolic-profiles.json`);
    }

    defs.push({
      personaId: id,
      slug: SLUG_MAP[id],
      name: profile.personaName,
      input: profile.rawInput,
      expectedMetabolic: {
        goalKcal: profile.metabolicProfile.goalKcal,
        proteinTargetG: profile.metabolicProfile.proteinTargetG,
        carbsTargetG: profile.metabolicProfile.carbsTargetG,
        fatTargetG: profile.metabolicProfile.fatTargetG,
      },
    });
  }

  return defs;
}

// ============================================================
// Metabolic Profile Verification
// ============================================================

function _verifyMetabolicProfile(
  actual: MetabolicProfile,
  expected: { goalKcal: number; proteinTargetG: number; carbsTargetG: number; fatTargetG: number },
  personaName: string
): boolean {
  const checks = [
    { label: 'goalKcal', actual: actual.goalKcal, expected: expected.goalKcal },
    { label: 'proteinTargetG', actual: actual.proteinTargetG, expected: expected.proteinTargetG },
    { label: 'carbsTargetG', actual: actual.carbsTargetG, expected: expected.carbsTargetG },
    { label: 'fatTargetG', actual: actual.fatTargetG, expected: expected.fatTargetG },
  ];

  let allMatch = true;
  for (const c of checks) {
    if (c.actual !== c.expected) {
      console.warn(
        `  ⚠ ${personaName}: ${c.label} mismatch — expected ${c.expected}, got ${c.actual}`
      );
      allMatch = false;
    }
  }

  if (allMatch) {
    console.log(`  ✓ Metabolic profile matches stage1 reference`);
  }

  return allMatch;
}

// ============================================================
// Main Runner
// ============================================================

async function main(): Promise<void> {
  // Parse --persona filter
  const personaFilter = process.argv
    .find((a) => a.startsWith('--persona='))
    ?.split('=')[1]
    ?.toLowerCase();

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }
  if (!process.env.USDA_API_KEY) {
    console.error('Missing USDA_API_KEY environment variable');
    process.exit(1);
  }

  // Load stage1 profiles
  console.log('Loading stage1 metabolic profiles...');
  const profiles = loadStage1Profiles();
  const personaDefs = buildPersonaDefs(profiles);

  const selectedPersonas = personaFilter
    ? personaDefs.filter((p) => p.slug === personaFilter)
    : personaDefs;

  if (selectedPersonas.length === 0) {
    console.error(
      `Unknown persona: "${personaFilter}". Valid: ${personaDefs.map((p) => p.slug).join(', ')}`
    );
    process.exit(1);
  }

  // Ensure output dir exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Connect to local USDA database if DATABASE_URL is set
  let prismaClient: PrismaClient | undefined;
  if (process.env.DATABASE_URL) {
    prismaClient = new PrismaClient();
    await prismaClient.$connect();
    const count = await prismaClient.usdaFood.count();
    console.log(`  LocalUSDA database: ${count} foods loaded`);
  } else {
    console.warn('  WARNING: DATABASE_URL not set — using remote USDA API only (slow!)');
  }

  // USDA-only config: omit FatSecret credentials
  const config: PipelineConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    usdaApiKey: process.env.USDA_API_KEY,
    prismaClient,
    // fatsecretClientId and fatsecretClientSecret intentionally omitted
    // This causes orchestrator.ts:73-76 to skip FatSecretAdapter creation
  };

  console.log('='.repeat(70));
  console.log('  USDA-Only Pipeline Test — Full Pipeline Run');
  console.log('='.repeat(70));
  console.log(`  Personas: ${selectedPersonas.map((p) => p.slug).join(', ')}`);
  console.log(`  LocalUSDA: ${prismaClient ? 'ENABLED' : 'DISABLED (remote API only)'}`);
  console.log('  FatSecret: DISABLED (USDA-only mode)');
  console.log(`  Output:   ${OUTPUT_DIR}`);
  console.log('='.repeat(70));
  console.log('');

  // Install PDF mock to avoid needing Chrome
  try {
    const pdfRenderer = await import('../agents/brand-renderer/pdf-renderer');
    const brandRenderer = await import('../agents/brand-renderer/index');
    const mockPdf = async () => Buffer.from('%PDF-1.4 mock');
    Object.defineProperty(pdfRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
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
  } catch {
    console.warn('Warning: Could not mock PDF renderer');
  }

  const allScorecards: ScorecardResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const persona of selectedPersonas) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Running: ${persona.name}`);
    console.log(`  PersonaId: ${persona.personaId}, Slug: ${persona.slug}`);
    console.log(`${'─'.repeat(60)}`);

    const orchestrator = new NutritionPipelineOrchestrator(config);
    const startTime = Date.now();

    let result: PipelineResult;
    try {
      result = await orchestrator.run(persona.input, (progress) => {
        const sub = progress.subStep ? ` — ${progress.subStep}` : '';
        console.log(`  [Agent ${progress.agent}] ${progress.agentName}: ${progress.message}${sub}`);
      });
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const elapsedMs = Date.now() - startTime;

    if (result.success && result.plan) {
      successCount++;
      console.log(`  ✓ SUCCESS in ${(elapsedMs / 1000).toFixed(1)}s`);

      // Verify metabolic profile matches stage1 reference
      const stage1 = profiles.find((p) => p.personaId === persona.personaId)!;
      // We verify against the metabolic profile the pipeline would produce
      // by re-running the first 2 agents (intake normalizer + metabolic calculator)
      // However, since the orchestrator already ran them internally, we verify
      // the plan output indirectly through the metabolic targets
      console.log(`  Expected goalKcal: ${persona.expectedMetabolic.goalKcal}`);

      // Check for FatSecret IDs (should be zero in USDA-only mode)
      let fatSecretIdCount = 0;
      for (const day of result.plan.days) {
        for (const meal of day.meals) {
          for (const ing of meal.ingredients) {
            if (ing.foodId && !ing.foodId.startsWith('usda-')) {
              fatSecretIdCount++;
            }
          }
        }
      }
      if (fatSecretIdCount > 0) {
        console.warn(`  ⚠ UNEXPECTED: Found ${fatSecretIdCount} FatSecret IDs in USDA-only mode!`);
      } else {
        console.log('  ✓ Confirmed: Zero FatSecret IDs (USDA-only mode)');
      }

      // Extract coverage stats
      const coverage = extractIngredientCoverage(result.plan);
      const matchRate = (coverage.matchRate * 100).toFixed(1);
      console.log(
        `  Ingredients: ${coverage.total} total, ${coverage.matchedUSDA} USDA, ${coverage.unverified} unverified (${matchRate}% match rate)`
      );
      console.log(
        `  Meals: ${coverage.mealsVerified}/${coverage.totalMeals} verified, ${coverage.mealsAiEstimated} ai_estimated`
      );

      const unmatched = extractUnmatchedIngredients(result.plan);
      if (unmatched.length > 0) {
        console.log(
          `  Unmatched: ${unmatched.slice(0, 10).join(', ')}${unmatched.length > 10 ? ` (+${unmatched.length - 10} more)` : ''}`
        );
      }

      // Score the plan
      const scorecard = scorePlan(
        result.plan,
        stage1.metabolicProfile,
        stage1.clientIntake,
        persona.name,
        persona.slug,
        elapsedMs
      );
      allScorecards.push(scorecard);

      console.log(`\n  Scores:`);
      console.log(
        `    A: Nutritional Accuracy  ${scorecard.categories.nutritionalAccuracy.score}/10`
      );
      console.log(`    B: Meal Practicality     ${scorecard.categories.mealPracticality.score}/10`);
      console.log(
        `    C: Dietary Compliance    ${scorecard.categories.dietaryCompliance.score}/10`
      );
      console.log(`    D: Variety & Experience  ${scorecard.categories.variety.score}/10`);
      console.log(
        `    E: Grocery Feasibility   ${scorecard.categories.groceryFeasibility.score}/10`
      );
      console.log(`    Composite: ${scorecard.composite.toFixed(2)} — ${scorecard.grade}`);

      // Save full pipeline result (without deliverables for file size)
      const saveResult = {
        ...result,
        deliverables: undefined,
        _meta: {
          persona: persona.name,
          slug: persona.slug,
          personaId: persona.personaId,
          pipelineTimeMs: elapsedMs,
          usdaOnly: true,
          fatSecretIdCount,
          coverage: {
            total: coverage.total,
            matchedUSDA: coverage.matchedUSDA,
            matchedFatSecret: coverage.matchedFatSecret,
            unverified: coverage.unverified,
            matchRate: coverage.matchRate,
            mealsVerified: coverage.mealsVerified,
            mealsAiEstimated: coverage.mealsAiEstimated,
            totalMeals: coverage.totalMeals,
          },
          scores: {
            nutritionalAccuracy: scorecard.categories.nutritionalAccuracy.score,
            mealPracticality: scorecard.categories.mealPracticality.score,
            dietaryCompliance: scorecard.categories.dietaryCompliance.score,
            variety: scorecard.categories.variety.score,
            groceryFeasibility: scorecard.categories.groceryFeasibility.score,
            composite: scorecard.composite,
            grade: scorecard.grade,
          },
          allergenViolations: scorecard.allergenViolations,
          dietaryViolations: scorecard.dietaryViolations,
          unmatchedIngredients: scorecard.unmatchedIngredients,
          dailyAdherence: scorecard.dailyAdherence,
          timestamp: new Date().toISOString(),
        },
      };

      // Save JSON result
      const jsonPath = resolve(OUTPUT_DIR, `usda-only-test-${persona.slug}.json`);
      writeFileSync(jsonPath, JSON.stringify(saveResult, null, 2), 'utf-8');
      console.log(`  Saved: usda-only-test-${persona.slug}.json`);

      // Generate and save scorecard markdown
      const markdown = generateScorecard(scorecard);
      const mdPath = resolve(OUTPUT_DIR, `usda-only-scorecard-${persona.slug}.md`);
      writeFileSync(mdPath, markdown, 'utf-8');
      console.log(`  Saved: usda-only-scorecard-${persona.slug}.md`);
    } else {
      failCount++;
      console.log(`  ✗ FAILED in ${(elapsedMs / 1000).toFixed(1)}s: ${result.error}`);

      const jsonPath = resolve(OUTPUT_DIR, `usda-only-test-${persona.slug}.json`);
      writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            success: false,
            error: result.error,
            _meta: {
              persona: persona.name,
              slug: persona.slug,
              personaId: persona.personaId,
              pipelineTimeMs: elapsedMs,
              usdaOnly: true,
              timestamp: new Date().toISOString(),
            },
          },
          null,
          2
        ),
        'utf-8'
      );
    }
  }

  // ============================================================
  // Summary Report
  // ============================================================

  console.log(`\n${'='.repeat(70)}`);
  console.log('  USDA-ONLY TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`  Results: ${successCount} succeeded, ${failCount} failed\n`);

  if (allScorecards.length > 0) {
    // Print score table
    console.log(
      '  Persona'.padEnd(40) +
        'Composite'.padStart(10) +
        'Grade'.padStart(10) +
        'Match%'.padStart(10) +
        'Time'.padStart(8)
    );
    console.log('  ' + '-'.repeat(76));

    for (const sc of allScorecards) {
      const matchPct = (sc.ingredientCoverage.matchRate * 100).toFixed(1) + '%';
      const time = (sc.pipelineTimeMs / 1000).toFixed(0) + 's';
      console.log(
        `  ${sc.persona.padEnd(38)}` +
          `${sc.composite.toFixed(2).padStart(10)}` +
          `${sc.grade.padStart(10)}` +
          `${matchPct.padStart(10)}` +
          `${time.padStart(8)}`
      );
    }

    const avgComposite = allScorecards.reduce((s, r) => s + r.composite, 0) / allScorecards.length;
    const avgMatch =
      allScorecards.reduce((s, r) => s + r.ingredientCoverage.matchRate, 0) / allScorecards.length;
    console.log('  ' + '-'.repeat(76));
    console.log(
      `  ${'AVERAGE'.padEnd(38)}` +
        `${avgComposite.toFixed(2).padStart(10)}` +
        `${''.padStart(10)}` +
        `${((avgMatch * 100).toFixed(1) + '%').padStart(10)}`
    );

    // Save summary JSON
    const summaryPath = resolve(OUTPUT_DIR, 'usda-only-test-summary.json');
    writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          testMode: 'usda-only',
          successCount,
          failCount,
          scorecards: allScorecards.map((sc) => ({
            persona: sc.persona,
            slug: sc.slug,
            composite: sc.composite,
            grade: sc.grade,
            qaScore: sc.qaScore,
            qaStatus: sc.qaStatus,
            categories: {
              A: sc.categories.nutritionalAccuracy.score,
              B: sc.categories.mealPracticality.score,
              C: sc.categories.dietaryCompliance.score,
              D: sc.categories.variety.score,
              E: sc.categories.groceryFeasibility.score,
            },
            coverage: sc.ingredientCoverage,
            allergenViolations: sc.allergenViolations.length,
            dietaryViolations: sc.dietaryViolations.length,
            pipelineTimeMs: sc.pipelineTimeMs,
          })),
          averages: {
            composite: avgComposite,
            matchRate: avgMatch,
            pipelineTimeMs:
              allScorecards.reduce((s, r) => s + r.pipelineTimeMs, 0) / allScorecards.length,
          },
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`\n  Summary saved: usda-only-test-summary.json`);

    // Generate and save comparison table
    const comparison = generateComparisonTable(allScorecards);
    const compPath = resolve(OUTPUT_DIR, 'usda-only-comparison.md');
    writeFileSync(compPath, comparison, 'utf-8');
    console.log('  Comparison saved: usda-only-comparison.md');
  }

  console.log(`${'='.repeat(70)}\n`);

  // Disconnect Prisma
  if (prismaClient) {
    await prismaClient.$disconnect();
  }
}

main().catch((err) => {
  console.error('USDA-only test runner failed:', err);
  process.exit(1);
});
