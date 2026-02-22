#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Calorie Overshoot Fix — Validation Runner
 *
 * Runs the full pipeline for 3 personas (Diane, Takeshi, Sarah)
 * that had the worst calorie overshoots in the ingredient-level baseline,
 * then outputs results as JSON for scoring comparison.
 *
 * Usage:
 *   cd packages/nutrition-engine
 *   ANTHROPIC_API_KEY=... FATSECRET_CLIENT_ID=... FATSECRET_CLIENT_SECRET=... \
 *     npx tsx src/__benchmarks__/run-fix-validation.ts
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';
import type { RawIntakeForm } from '../types/schemas';

// ============================================================
// 3 Target Personas (worst overshoot cases)
// ============================================================

const DIANE: RawIntakeForm = {
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
};

const TAKESHI: RawIntakeForm = {
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
};

const SARAH: RawIntakeForm = {
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
};

// ============================================================
// 3 Additional Personas (diverse edge cases)
// ============================================================

const JENNIFER: RawIntakeForm = {
  name: 'Jennifer',
  sex: 'female',
  age: 38,
  heightFeet: 5,
  heightInches: 7,
  weightLbs: 170,
  goalType: 'cut',
  goalRate: 1.0,
  activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday'],
  dietaryStyle: 'omnivore',
  allergies: ['peanut', 'shellfish'],
  exclusions: ['pork'],
  cuisinePreferences: ['american', 'italian'],
  mealsPerDay: 3,
  snacksPerDay: 2,
  cookingSkill: 6,
  prepTimeMaxMin: 30,
  macroStyle: 'keto',
  planDurationDays: 7,
};

const RAJ: RawIntakeForm = {
  name: 'Raj',
  sex: 'male',
  age: 32,
  heightCm: 175,
  weightKg: 72,
  goalType: 'maintain',
  goalRate: 0,
  activityLevel: 'very_active',
  trainingDays: ['monday', 'tuesday', 'thursday', 'friday', 'saturday'],
  dietaryStyle: 'vegan',
  allergies: ['soy'],
  exclusions: [],
  cuisinePreferences: ['indian', 'mediterranean', 'mexican'],
  mealsPerDay: 4,
  snacksPerDay: 1,
  cookingSkill: 7,
  prepTimeMaxMin: 45,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

const MARCUS: RawIntakeForm = {
  name: 'Marcus',
  sex: 'male',
  age: 52,
  heightFeet: 6,
  heightInches: 1,
  weightLbs: 230,
  goalType: 'cut',
  goalRate: 1.5,
  activityLevel: 'lightly_active',
  trainingDays: ['tuesday', 'thursday', 'saturday'],
  dietaryStyle: 'omnivore',
  allergies: ['dairy'],
  exclusions: [],
  cuisinePreferences: ['american', 'asian'],
  mealsPerDay: 3,
  snacksPerDay: 1,
  cookingSkill: 4,
  prepTimeMaxMin: 20,
  macroStyle: 'high_protein',
  planDurationDays: 7,
};

const KAYLA: RawIntakeForm = {
  name: 'Kayla',
  sex: 'female',
  age: 20,
  heightFeet: 5,
  heightInches: 9,
  weightLbs: 145,
  goalType: 'maintain',
  goalRate: 0,
  activityLevel: 'very_active',
  trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  trainingTime: 'morning',
  dietaryStyle: 'omnivore',
  allergies: [],
  exclusions: [],
  cuisinePreferences: ['american', 'mexican'],
  mealsPerDay: 4,
  snacksPerDay: 2,
  cookingSkill: 3,
  prepTimeMaxMin: 15,
  macroStyle: 'high_protein',
  planDurationDays: 7,
};

const PRIYA: RawIntakeForm = {
  name: 'Priya',
  sex: 'female',
  age: 16,
  heightCm: 162,
  weightKg: 52,
  goalType: 'bulk',
  goalRate: 0.25,
  activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday'],
  dietaryStyle: 'vegetarian',
  allergies: ['peanut'],
  exclusions: ['mushroom'],
  cuisinePreferences: ['indian', 'mediterranean'],
  mealsPerDay: 3,
  snacksPerDay: 2,
  cookingSkill: 4,
  prepTimeMaxMin: 25,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

const PERSONAS = [
  { label: 'Diane (Minimalist Cook)', input: DIANE },
  { label: 'Takeshi (Pescatarian Bodybuilder)', input: TAKESHI },
  { label: 'Sarah (Petite Cutting)', input: SARAH },
  { label: 'Jennifer (Keto Multi-Allergy)', input: JENNIFER },
  { label: 'Raj (Vegan Athlete)', input: RAJ },
  { label: 'Marcus (Large Man Cutting)', input: MARCUS },
  { label: 'Kayla (College Athlete)', input: KAYLA },
  { label: 'Priya (Teen Vegetarian)', input: PRIYA },
];

// ============================================================
// Main Runner
// ============================================================

async function main(): Promise<void> {
  const config: PipelineConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    usdaApiKey: process.env.USDA_API_KEY || '',
    fatsecretClientId: process.env.FATSECRET_CLIENT_ID || undefined,
    fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || undefined,
  };

  if (!config.anthropicApiKey || !config.usdaApiKey) {
    console.error('ERROR: Missing required env vars: ANTHROPIC_API_KEY, USDA_API_KEY');
    process.exit(1);
  }

  const outputDir =
    '/Users/zero-suminc./Desktop/ZS-MAC/NE Implementation/Nutrition Engine testing:validation';

  console.log('='.repeat(70));
  console.log(
    '  Fix Validation Run v3: recalibration + ml conversion + macro-aware + low-cal caps'
  );
  console.log(`  Personas: ${PERSONAS.map((p) => p.input.name).join(', ')}`);
  console.log('='.repeat(70));
  console.log('');

  const summary: Array<{
    persona: string;
    success: boolean;
    timeMs: number;
    totalIngredients: number;
    verifiedIngredients: number;
    unverifiedIngredients: number;
    dailyCalories: Array<{ day: number; target: number; actual: number; variance: string }>;
    dailyMacros: Array<{
      day: number;
      protein: { actual: number; target: number };
      carbs: { actual: number; target: number };
      fat: { actual: number; target: number };
    }>;
  }> = [];

  for (const persona of PERSONAS) {
    console.log(`\n--- Running: ${persona.label} ---`);
    const orchestrator = new NutritionPipelineOrchestrator(config);
    const startTime = Date.now();

    let result: PipelineResult;
    try {
      result = await orchestrator.run(persona.input, (progress) => {
        if (progress.message) {
          console.log(`  [${progress.agentName}] ${progress.message}`);
        }
      });
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
      result = { success: false, error: String(err) };
    }

    const elapsed = Date.now() - startTime;
    console.log(`  Completed in ${(elapsed / 1000).toFixed(1)}s — success: ${result.success}`);

    // Write full result to JSON
    const filename = `fix-validation-${persona.input.name!.toLowerCase()}.json`;
    writeFileSync(resolve(outputDir, filename), JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  Output: ${filename}`);

    // Extract summary stats
    if (result.success && result.plan) {
      const plan = result.plan;

      let totalIngredients = 0;
      let verifiedIngredients = 0;
      const dailyCalories: Array<{
        day: number;
        target: number;
        actual: number;
        variance: string;
      }> = [];
      const dailyMacros: Array<{
        day: number;
        protein: { actual: number; target: number };
        carbs: { actual: number; target: number };
        fat: { actual: number; target: number };
      }> = [];

      for (const day of plan.days) {
        dailyCalories.push({
          day: day.dayNumber,
          target: day.targetKcal,
          actual: day.dailyTotals.kcal,
          variance: `${day.variancePercent > 0 ? '+' : ''}${day.variancePercent}%`,
        });

        // Sum macro targets from each meal's targetNutrition
        let targetP = 0,
          targetC = 0,
          targetF = 0;
        for (const meal of day.meals) {
          targetP += meal.nutrition.proteinG ? 0 : 0; // just for counting
          for (const ing of meal.ingredients) {
            totalIngredients++;
            if (ing.foodId) verifiedIngredients++;
          }
        }
        // Use macroTargets from the compiled day
        targetP = day.macroTargets?.proteinG ?? 0;
        targetC = day.macroTargets?.carbsG ?? 0;
        targetF = day.macroTargets?.fatG ?? 0;

        dailyMacros.push({
          day: day.dayNumber,
          protein: { actual: day.dailyTotals.proteinG, target: targetP },
          carbs: { actual: day.dailyTotals.carbsG, target: targetC },
          fat: { actual: day.dailyTotals.fatG, target: targetF },
        });
      }

      const unverifiedIngredients = totalIngredients - verifiedIngredients;

      summary.push({
        persona: persona.label,
        success: true,
        timeMs: elapsed,
        totalIngredients,
        verifiedIngredients,
        unverifiedIngredients,
        dailyCalories,
        dailyMacros,
      });

      // Print daily calorie adherence
      console.log('  Daily calorie adherence:');
      for (const dc of dailyCalories) {
        const marker = Math.abs(dc.actual - dc.target) / dc.target > 0.1 ? ' ⚠' : ' ✓';
        console.log(
          `    Day ${dc.day}: ${dc.actual} / ${dc.target} kcal (${dc.variance})${marker}`
        );
      }

      // Print daily macro adherence
      console.log('  Daily macro adherence:');
      for (const dm of dailyMacros) {
        const pPct =
          dm.protein.target > 0
            ? (((dm.protein.actual - dm.protein.target) / dm.protein.target) * 100).toFixed(1)
            : '?';
        const cPct =
          dm.carbs.target > 0
            ? (((dm.carbs.actual - dm.carbs.target) / dm.carbs.target) * 100).toFixed(1)
            : '?';
        const fPct =
          dm.fat.target > 0
            ? (((dm.fat.actual - dm.fat.target) / dm.fat.target) * 100).toFixed(1)
            : '?';
        console.log(
          `    Day ${dm.day}: P ${dm.protein.actual}/${dm.protein.target}g (${pPct}%) | C ${dm.carbs.actual}/${dm.carbs.target}g (${cPct}%) | F ${dm.fat.actual}/${dm.fat.target}g (${fPct}%)`
        );
      }

      console.log(
        `  Ingredients: ${verifiedIngredients}/${totalIngredients} verified (${unverifiedIngredients} unverified)`
      );
    } else {
      summary.push({
        persona: persona.label,
        success: false,
        timeMs: elapsed,
        totalIngredients: 0,
        verifiedIngredients: 0,
        unverifiedIngredients: 0,
        dailyCalories: [],
        dailyMacros: [],
      });
    }
  }

  // Write summary
  const summaryPath = resolve(outputDir, 'fix-validation-summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify({ timestamp: new Date().toISOString(), results: summary }, null, 2),
    'utf-8'
  );
  console.log(`\n\nSummary written to: fix-validation-summary.json`);

  // Print comparison table
  console.log('\n' + '='.repeat(70));
  console.log('  RESULTS SUMMARY');
  console.log('='.repeat(70));
  for (const s of summary) {
    console.log(`\n  ${s.persona}:`);
    console.log(`    Success: ${s.success}`);
    console.log(`    Time: ${(s.timeMs / 1000).toFixed(1)}s`);
    console.log(`    Ingredients: ${s.verifiedIngredients}/${s.totalIngredients} verified`);
    if (s.dailyCalories.length > 0) {
      const maxKcalVar = Math.max(
        ...s.dailyCalories.map((dc) => Math.abs(((dc.actual - dc.target) / dc.target) * 100))
      );
      const daysOver10 = s.dailyCalories.filter(
        (dc) => Math.abs((dc.actual - dc.target) / dc.target) > 0.1
      ).length;
      const avgKcalVar =
        s.dailyCalories.reduce(
          (sum, dc) => sum + Math.abs(((dc.actual - dc.target) / dc.target) * 100),
          0
        ) / s.dailyCalories.length;
      console.log(
        `    Calorie: max ${maxKcalVar.toFixed(1)}% | avg ${avgKcalVar.toFixed(1)}% | days >10%: ${daysOver10}/7`
      );

      if (s.dailyMacros.length > 0) {
        const avgProtVar =
          s.dailyMacros.reduce(
            (sum, dm) =>
              sum +
              (dm.protein.target > 0
                ? Math.abs(((dm.protein.actual - dm.protein.target) / dm.protein.target) * 100)
                : 0),
            0
          ) / s.dailyMacros.length;
        const avgCarbVar =
          s.dailyMacros.reduce(
            (sum, dm) =>
              sum +
              (dm.carbs.target > 0
                ? Math.abs(((dm.carbs.actual - dm.carbs.target) / dm.carbs.target) * 100)
                : 0),
            0
          ) / s.dailyMacros.length;
        const avgFatVar =
          s.dailyMacros.reduce(
            (sum, dm) =>
              sum +
              (dm.fat.target > 0
                ? Math.abs(((dm.fat.actual - dm.fat.target) / dm.fat.target) * 100)
                : 0),
            0
          ) / s.dailyMacros.length;
        console.log(
          `    Macros avg |Δ|: P ${avgProtVar.toFixed(1)}% | C ${avgCarbVar.toFixed(1)}% | F ${avgFatVar.toFixed(1)}%`
        );
      }
    }
  }

  // Cross-persona aggregate stats
  const successResults = summary.filter((s) => s.success && s.dailyCalories.length > 0);
  if (successResults.length > 0) {
    const allDays = successResults.flatMap((s) => s.dailyCalories);
    const allMacros = successResults.flatMap((s) => s.dailyMacros);
    const totalDays = allDays.length;
    const daysWithin5 = allDays.filter(
      (dc) => Math.abs((dc.actual - dc.target) / dc.target) <= 0.05
    ).length;
    const daysWithin10 = allDays.filter(
      (dc) => Math.abs((dc.actual - dc.target) / dc.target) <= 0.1
    ).length;
    const daysOver20 = allDays.filter(
      (dc) => Math.abs((dc.actual - dc.target) / dc.target) > 0.2
    ).length;
    const avgKcalVar =
      allDays.reduce((sum, dc) => sum + Math.abs(((dc.actual - dc.target) / dc.target) * 100), 0) /
      totalDays;

    const avgProtVar =
      allMacros.reduce(
        (sum, dm) =>
          sum +
          (dm.protein.target > 0
            ? Math.abs(((dm.protein.actual - dm.protein.target) / dm.protein.target) * 100)
            : 0),
        0
      ) / allMacros.length;
    const avgFatVar =
      allMacros.reduce(
        (sum, dm) =>
          sum +
          (dm.fat.target > 0
            ? Math.abs(((dm.fat.actual - dm.fat.target) / dm.fat.target) * 100)
            : 0),
        0
      ) / allMacros.length;
    const avgCarbVar =
      allMacros.reduce(
        (sum, dm) =>
          sum +
          (dm.carbs.target > 0
            ? Math.abs(((dm.carbs.actual - dm.carbs.target) / dm.carbs.target) * 100)
            : 0),
        0
      ) / allMacros.length;

    console.log('\n' + '='.repeat(70));
    console.log('  AGGREGATE STATS (all personas)');
    console.log('='.repeat(70));
    console.log(`  Total days: ${totalDays}`);
    console.log(
      `  Days within 5% kcal: ${daysWithin5}/${totalDays} (${((daysWithin5 / totalDays) * 100).toFixed(0)}%)`
    );
    console.log(
      `  Days within 10% kcal: ${daysWithin10}/${totalDays} (${((daysWithin10 / totalDays) * 100).toFixed(0)}%)`
    );
    console.log(
      `  Days >20% variance: ${daysOver20}/${totalDays} (${((daysOver20 / totalDays) * 100).toFixed(0)}%)`
    );
    console.log(`  Avg absolute kcal variance: ${avgKcalVar.toFixed(1)}%`);
    console.log(
      `  Avg absolute macro variance: P ${avgProtVar.toFixed(1)}% | C ${avgCarbVar.toFixed(1)}% | F ${avgFatVar.toFixed(1)}%`
    );
    console.log(
      `  Total ingredients verified: ${successResults.reduce((s, r) => s + r.verifiedIngredients, 0)}/${successResults.reduce((s, r) => s + r.totalIngredients, 0)}`
    );
  }
}

main().catch((err) => {
  console.error('Validation run failed:', err);
  process.exit(1);
});
