#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Ingredient-Level FatSecret Test Runner
 *
 * Runs all 10 synthetic personas through the full pipeline with live APIs,
 * saves results and tracks ingredient-level coverage metrics.
 *
 * Usage:
 *   tsx src/__benchmarks__/run-ingredient-test.ts [--persona=marcus]
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';
import type { RawIntakeForm } from '../types/schemas';

// ============================================================
// Output Directory
// ============================================================

const OUTPUT_DIR = resolve(
  '/Users/zero-suminc./Desktop/ZS-MAC/NE Implementation/Nutrition Engine testing:validation'
);

// ============================================================
// 10 Personas (exact RawIntakeForm from synthetic-personas.md)
// ============================================================

interface PersonaDef {
  slug: string;
  name: string;
  input: RawIntakeForm;
}

const PERSONAS: PersonaDef[] = [
  {
    slug: 'marcus',
    name: 'Marcus (Busy Professional)',
    input: {
      name: 'Marcus',
      sex: 'male',
      age: 32,
      heightFeet: 5,
      heightInches: 10,
      weightLbs: 195,
      goalType: 'cut',
      goalRate: 1.5,
      activityLevel: 'sedentary',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'mediterranean'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 4,
      prepTimeMaxMin: 20,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'kayla',
    name: 'Kayla (College Athlete)',
    input: {
      name: 'Kayla',
      sex: 'female',
      age: 21,
      heightFeet: 5,
      heightInches: 7,
      weightLbs: 145,
      goalType: 'bulk',
      goalRate: 0.5,
      activityLevel: 'extremely_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      trainingTime: 'afternoon',
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'asian'],
      mealsPerDay: 4,
      snacksPerDay: 2,
      cookingSkill: 3,
      prepTimeMaxMin: 25,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  {
    slug: 'raj',
    name: 'Raj (Vegan Runner)',
    input: {
      name: 'Raj',
      sex: 'male',
      age: 28,
      heightCm: 180,
      weightKg: 72,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'morning',
      dietaryStyle: 'vegan',
      allergies: ['soy'],
      exclusions: [],
      cuisinePreferences: ['mediterranean', 'indian', 'thai'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkill: 7,
      prepTimeMaxMin: 45,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'jennifer',
    name: 'Jennifer (Keto Mom)',
    input: {
      name: 'Jennifer',
      sex: 'female',
      age: 38,
      heightFeet: 5,
      heightInches: 5,
      weightLbs: 160,
      goalType: 'cut',
      goalRate: 1.0,
      activityLevel: 'lightly_active',
      trainingDays: ['tuesday', 'thursday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: ['dairy'],
      exclusions: [],
      cuisinePreferences: ['american', 'mexican'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 6,
      prepTimeMaxMin: 30,
      macroStyle: 'keto',
      planDurationDays: 7,
    },
  },
  {
    slug: 'robert',
    name: 'Robert (Senior Allergies)',
    input: {
      name: 'Robert',
      sex: 'male',
      age: 67,
      heightFeet: 5,
      heightInches: 9,
      weightLbs: 180,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'sedentary',
      trainingDays: [],
      dietaryStyle: 'omnivore',
      allergies: ['peanut', 'tree nut', 'shellfish', 'gluten'],
      exclusions: [],
      cuisinePreferences: ['american', 'italian', 'greek'],
      mealsPerDay: 3,
      snacksPerDay: 0,
      cookingSkill: 5,
      prepTimeMaxMin: 40,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  {
    slug: 'sarah',
    name: 'Sarah (Petite Cutting)',
    input: {
      name: 'Sarah',
      sex: 'female',
      age: 24,
      heightFeet: 5,
      heightInches: 2,
      weightLbs: 110,
      goalType: 'cut',
      goalRate: 2.0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'asian', 'mediterranean'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'takeshi',
    name: 'Takeshi (Pescatarian Bodybuilder)',
    input: {
      name: 'Takeshi',
      sex: 'male',
      age: 29,
      heightCm: 178,
      weightKg: 85,
      bodyFatPercent: 14,
      goalType: 'bulk',
      goalRate: 0.5,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'afternoon',
      dietaryStyle: 'pescatarian',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['japanese', 'mediterranean', 'thai'],
      mealsPerDay: 5,
      snacksPerDay: 1,
      cookingSkill: 8,
      prepTimeMaxMin: 60,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'diane',
    name: 'Diane (Minimalist Cook)',
    input: {
      name: 'Diane',
      sex: 'female',
      age: 45,
      heightFeet: 5,
      heightInches: 6,
      weightLbs: 155,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'lightly_active',
      trainingDays: ['wednesday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: ['egg'],
      exclusions: [],
      cuisinePreferences: ['american'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 2,
      prepTimeMaxMin: 15,
      macroStyle: 'low_carb',
      planDurationDays: 7,
    },
  },
  {
    slug: 'priya',
    name: 'Priya (Teen Vegetarian)',
    input: {
      name: 'Priya',
      sex: 'female',
      age: 18,
      heightCm: 163,
      weightKg: 55,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'vegetarian',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['indian', 'italian'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkill: 3,
      prepTimeMaxMin: 20,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  {
    slug: 'darius',
    name: 'Darius (Large Man Bulking)',
    input: {
      name: 'Darius',
      sex: 'male',
      age: 25,
      heightFeet: 6,
      heightInches: 4,
      weightLbs: 245,
      bodyFatPercent: 18,
      goalType: 'bulk',
      goalRate: 2.0,
      activityLevel: 'extremely_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      trainingTime: 'morning',
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'mexican', 'korean'],
      mealsPerDay: 4,
      snacksPerDay: 2,
      cookingSkill: 6,
      prepTimeMaxMin: 45,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
];

// ============================================================
// Coverage Metrics
// ============================================================

interface IngredientCoverage {
  persona: string;
  totalIngredients: number;
  matchedFatSecret: number;
  matchedUSDA: number;
  unverified: number;
  mealsVerified: number;
  mealsAiEstimated: number;
  totalMeals: number;
  failedIngredients: string[];
  pipelineTimeMs: number;
}

function extractCoverage(
  persona: PersonaDef,
  result: PipelineResult,
  elapsedMs: number
): IngredientCoverage {
  const coverage: IngredientCoverage = {
    persona: persona.name,
    totalIngredients: 0,
    matchedFatSecret: 0,
    matchedUSDA: 0,
    unverified: 0,
    mealsVerified: 0,
    mealsAiEstimated: 0,
    totalMeals: 0,
    failedIngredients: [],
    pipelineTimeMs: elapsedMs,
  };

  if (!result.plan) return coverage;

  for (const day of result.plan.days) {
    for (const meal of day.meals) {
      coverage.totalMeals++;
      if (meal.confidenceLevel === 'verified') {
        coverage.mealsVerified++;
      } else {
        coverage.mealsAiEstimated++;
      }

      for (const ing of meal.ingredients) {
        coverage.totalIngredients++;
        if (ing.fatsecretFoodId) {
          if (ing.fatsecretFoodId.startsWith('usda-')) {
            coverage.matchedUSDA++;
          } else {
            coverage.matchedFatSecret++;
          }
        } else {
          coverage.unverified++;
          coverage.failedIngredients.push(ing.name);
        }
      }
    }
  }

  return coverage;
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

  const selectedPersonas = personaFilter
    ? PERSONAS.filter((p) => p.slug === personaFilter)
    : PERSONAS;

  if (selectedPersonas.length === 0) {
    console.error(
      `Unknown persona: "${personaFilter}". Valid: ${PERSONAS.map((p) => p.slug).join(', ')}`
    );
    process.exit(1);
  }

  // Ensure output dir exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const config: PipelineConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    fatsecretClientId: process.env.FATSECRET_CLIENT_ID || '',
    fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || '',
    usdaApiKey: process.env.USDA_API_KEY,
  };

  console.log('='.repeat(70));
  console.log('  Ingredient-Level FatSecret Test — Full Pipeline Run');
  console.log('='.repeat(70));
  console.log(`  Personas: ${selectedPersonas.map((p) => p.slug).join(', ')}`);
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

  const allCoverage: IngredientCoverage[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const persona of selectedPersonas) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Running: ${persona.name}`);
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

    if (result.success) {
      successCount++;
      console.log(`  ✓ SUCCESS in ${(elapsedMs / 1000).toFixed(1)}s`);

      // Extract coverage
      const coverage = extractCoverage(persona, result, elapsedMs);
      allCoverage.push(coverage);

      const matchRate =
        coverage.totalIngredients > 0
          ? (
              ((coverage.matchedFatSecret + coverage.matchedUSDA) / coverage.totalIngredients) *
              100
            ).toFixed(1)
          : '0';

      console.log(
        `  Ingredients: ${coverage.totalIngredients} total, ` +
          `${coverage.matchedFatSecret} FatSecret, ${coverage.matchedUSDA} USDA, ` +
          `${coverage.unverified} unverified (${matchRate}% match rate)`
      );
      console.log(
        `  Meals: ${coverage.mealsVerified}/${coverage.totalMeals} verified, ` +
          `${coverage.mealsAiEstimated} ai_estimated`
      );

      if (coverage.failedIngredients.length > 0) {
        const unique = [...new Set(coverage.failedIngredients)];
        console.log(
          `  Failed ingredients: ${unique.slice(0, 10).join(', ')}${unique.length > 10 ? ` (+${unique.length - 10} more)` : ''}`
        );
      }

      // Save result (without deliverables to keep file size reasonable)
      const saveResult = {
        ...result,
        deliverables: undefined,
        _meta: {
          persona: persona.name,
          slug: persona.slug,
          pipelineTimeMs: elapsedMs,
          coverage,
          timestamp: new Date().toISOString(),
        },
      };

      const outputPath = resolve(OUTPUT_DIR, `ingredient-level-test-${persona.slug}.json`);
      writeFileSync(outputPath, JSON.stringify(saveResult, null, 2), 'utf-8');
      console.log(`  Saved: ingredient-level-test-${persona.slug}.json`);
    } else {
      failCount++;
      console.log(`  ✗ FAILED in ${(elapsedMs / 1000).toFixed(1)}s: ${result.error}`);

      // Save failure result
      const outputPath = resolve(OUTPUT_DIR, `ingredient-level-test-${persona.slug}.json`);
      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            success: false,
            error: result.error,
            _meta: {
              persona: persona.name,
              slug: persona.slug,
              pipelineTimeMs: elapsedMs,
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
  console.log('  INGREDIENT-LEVEL TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`  Results: ${successCount} succeeded, ${failCount} failed\n`);

  if (allCoverage.length > 0) {
    // Print coverage table
    console.log(
      '  Persona'.padEnd(35) +
        'Ingredients'.padStart(12) +
        'Matched'.padStart(10) +
        'Unverified'.padStart(12) +
        'Match%'.padStart(8) +
        'Verified'.padStart(10) +
        'Time'.padStart(8)
    );
    console.log('  ' + '-'.repeat(93));

    let totalIng = 0,
      totalMatched = 0,
      totalUnverified = 0,
      totalVerifiedMeals = 0,
      totalMeals = 0,
      totalTime = 0;

    for (const c of allCoverage) {
      const matched = c.matchedFatSecret + c.matchedUSDA;
      const rate = c.totalIngredients > 0 ? ((matched / c.totalIngredients) * 100).toFixed(1) : '0';
      const verifiedRate = c.totalMeals > 0 ? `${c.mealsVerified}/${c.totalMeals}` : '0/0';

      console.log(
        `  ${c.persona.padEnd(33)}` +
          `${String(c.totalIngredients).padStart(12)}` +
          `${String(matched).padStart(10)}` +
          `${String(c.unverified).padStart(12)}` +
          `${(rate + '%').padStart(8)}` +
          `${verifiedRate.padStart(10)}` +
          `${((c.pipelineTimeMs / 1000).toFixed(0) + 's').padStart(8)}`
      );

      totalIng += c.totalIngredients;
      totalMatched += matched;
      totalUnverified += c.unverified;
      totalVerifiedMeals += c.mealsVerified;
      totalMeals += c.totalMeals;
      totalTime += c.pipelineTimeMs;
    }

    console.log('  ' + '-'.repeat(93));

    const avgRate = totalIng > 0 ? ((totalMatched / totalIng) * 100).toFixed(1) : '0';
    console.log(
      `  ${'TOTAL'.padEnd(33)}` +
        `${String(totalIng).padStart(12)}` +
        `${String(totalMatched).padStart(10)}` +
        `${String(totalUnverified).padStart(12)}` +
        `${(avgRate + '%').padStart(8)}` +
        `${(totalVerifiedMeals + '/' + totalMeals).padStart(10)}` +
        `${((totalTime / 1000).toFixed(0) + 's').padStart(8)}`
    );

    // Collect all failed ingredients across personas
    const allFailed: Record<string, number> = {};
    for (const c of allCoverage) {
      for (const name of c.failedIngredients) {
        allFailed[name] = (allFailed[name] || 0) + 1;
      }
    }

    if (Object.keys(allFailed).length > 0) {
      console.log(`\n  Most Common Unmatched Ingredients:`);
      const sorted = Object.entries(allFailed).sort((a, b) => b[1] - a[1]);
      for (const [name, count] of sorted.slice(0, 20)) {
        console.log(`    ${name} (${count}x)`);
      }
    }

    // Save summary
    const summaryPath = resolve(OUTPUT_DIR, 'ingredient-level-test-summary.json');
    writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          successCount,
          failCount,
          coverage: allCoverage,
          aggregates: {
            totalIngredients: totalIng,
            totalMatched,
            totalUnverified,
            matchRate: totalIng > 0 ? totalMatched / totalIng : 0,
            totalVerifiedMeals,
            totalMeals,
            verifiedMealRate: totalMeals > 0 ? totalVerifiedMeals / totalMeals : 0,
            avgPipelineTimeMs: allCoverage.length > 0 ? totalTime / allCoverage.length : 0,
          },
          failedIngredients: allFailed,
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`\n  Summary saved: ingredient-level-test-summary.json`);
  }

  console.log(`${'='.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
