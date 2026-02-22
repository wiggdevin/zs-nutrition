/* eslint-disable no-console */
/**
 * Quick persona pipeline test — runs a persona through the full pipeline
 * with USDA-first configuration and outputs structured results.
 *
 * Usage: npx tsx run-persona-test.ts [personaNumber]
 * Default: persona 1 (Marcus)
 */

import { NutritionPipelineOrchestrator, PipelineConfig } from './src/orchestrator';
import { RawIntakeForm, PipelineProgress } from './src/types/schemas';

// No PDF mock needed — orchestrator already catches renderPdf failures
// and falls back to Buffer.alloc(0) when Puppeteer/Chrome is unavailable

const PERSONAS: Record<string, RawIntakeForm> = {
  '1': {
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
  } as RawIntakeForm,
  '3': {
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
  } as RawIntakeForm,
  '7': {
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
  } as RawIntakeForm,
};

async function main() {
  const personaId = process.argv[2] || '1';
  const input = PERSONAS[personaId];
  if (!input) {
    console.error(`Unknown persona: ${personaId}. Available: ${Object.keys(PERSONAS).join(', ')}`);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log(`  USDA-FIRST Pipeline Test — Persona ${personaId}: ${input.name}`);
  console.log('='.repeat(70));

  const config: PipelineConfig = {
    anthropicApiKey: 'YOUR_KEY_placeholder',
    usdaApiKey: 'placeholder-usda-key',
  };

  const orchestrator = new NutritionPipelineOrchestrator(config);
  const events: PipelineProgress[] = [];

  const start = Date.now();
  const result = await orchestrator.run(input, (p) => events.push({ ...p }));
  const elapsed = Date.now() - start;

  console.log(`\n  Pipeline: ${result.success ? 'SUCCESS' : 'FAILED'} (${elapsed}ms)`);
  if (result.error) console.log(`  Error: ${result.error}`);

  if (!result.success || !result.plan || !result.draft) {
    console.log('\n  Pipeline failed — no output to display.');
    process.exit(1);
  }

  // --- Metadata ---
  console.log('\n── Metadata ──────────────────────────────────────────');
  console.log(`  Calculation method: ${result.plan.calculationMethod}`);
  console.log(`  Protein method:     ${result.plan.proteinMethod}`);
  console.log(`  Kcal floor applied: ${result.plan.goalKcalFloorApplied}`);
  console.log(
    `  QA score:           ${result.plan.qa.score}/100 (${result.plan.qa.iterations} iteration)`
  );

  // --- Dump draft + plan structure keys for debugging ---
  console.log('\n── Structure Debug ───────────────────────────────────');
  console.log(`  result.draft keys: ${Object.keys(result.draft).join(', ')}`);
  if (result.draft.days?.[0]) {
    console.log(`  draft.days[0] keys: ${Object.keys(result.draft.days[0]).join(', ')}`);
  }
  console.log(`  result.plan keys: ${Object.keys(result.plan).join(', ')}`);
  if (result.plan.days?.[0]) {
    console.log(`  plan.days[0] keys: ${Object.keys(result.plan.days[0]).join(', ')}`);
    if (result.plan.days[0].meals?.[0]) {
      console.log(
        `  plan.days[0].meals[0] keys: ${Object.keys(result.plan.days[0].meals[0]).join(', ')}`
      );
    }
  }

  // --- Daily targets from plan ---
  console.log('\n── Daily Targets ─────────────────────────────────────');
  for (const day of result.plan.days) {
    const label = (day as any).dayName ?? day.dayLabel ?? '?';
    const type = day.isTrainingDay ? 'TRAIN' : 'REST ';
    const kcal = day.targetKcal ?? (day as any).totalKcal ?? '?';
    console.log(`  ${String(label).padEnd(12)} [${type}] ${kcal} kcal | ${day.meals.length} meals`);
  }

  // --- Day 1 meals detail ---
  const day1 = result.plan.days[0];
  const day1Label = (day1 as any).dayName ?? day1.dayLabel ?? 'Day 1';
  console.log(`\n── Day 1 Meals (${day1Label}) ───────────────────────────`);
  for (const meal of day1.meals) {
    const kcal = meal.nutrition?.kcal ?? 0;
    const p = meal.nutrition?.proteinG ?? 0;
    const c = meal.nutrition?.carbsG ?? 0;
    const f = meal.nutrition?.fatG ?? 0;
    const conf = meal.confidenceLevel ?? 'n/a';
    const slot = meal.slot ?? meal.mealSlot ?? '?';
    const name = meal.name ?? 'unnamed';
    console.log(
      `  ${String(slot).padEnd(10)} ${String(name).padEnd(40).slice(0, 40)} ${String(kcal).padStart(5)} kcal  P:${p}g C:${c}g F:${f}g  [${conf}]`
    );
    if (meal.ingredients?.length > 0) {
      for (const ing of meal.ingredients.slice(0, 3)) {
        console.log(`             - ${ing.name} (${ing.amount}${ing.unit})`);
      }
      if (meal.ingredients.length > 3) {
        console.log(`             ... +${meal.ingredients.length - 3} more`);
      }
    }
  }

  // --- QA day results ---
  console.log('\n── QA Results ────────────────────────────────────────');
  for (const dayQa of result.plan.qa.dayResults) {
    const dayNum = (dayQa as any).dayNumber ?? '?';
    const variance = (dayQa as any).variancePercent?.toFixed(1) ?? '?';
    const mv = (dayQa as any).macroVariances;
    const macros = mv
      ? `P:${mv.proteinPercent?.toFixed(1)}% C:${mv.carbsPercent?.toFixed(1)}% F:${mv.fatPercent?.toFixed(1)}%`
      : '';
    console.log(
      `  Day ${String(dayNum).padEnd(3)} ${String(dayQa.status).padEnd(5)} | Variance: ${variance}% ${macros}`
    );
  }

  // --- Variety report ---
  console.log('\n── Variety Report ────────────────────────────────────');
  if (result.draft.varietyReport) {
    console.log(
      `  Proteins used (${result.draft.varietyReport.proteinsUsed.length}): ${result.draft.varietyReport.proteinsUsed.join(', ')}`
    );
    console.log(
      `  Cuisines used (${result.draft.varietyReport.cuisinesUsed.length}): ${result.draft.varietyReport.cuisinesUsed.join(', ')}`
    );
  } else {
    console.log('  (no variety report available)');
  }

  // --- Deliverables sizes ---
  console.log('\n── Deliverables ──────────────────────────────────────');
  if (result.deliverables) {
    console.log(`  summaryHtml: ${result.deliverables.summaryHtml.length} chars`);
    console.log(`  gridHtml:    ${result.deliverables.gridHtml.length} chars`);
    console.log(`  groceryHtml: ${result.deliverables.groceryHtml.length} chars`);
    console.log(`  pdfBuffer:   ${result.deliverables.pdfBuffer.length} bytes`);
  } else {
    console.log('  (no deliverables)');
  }

  // --- Progress events ---
  console.log('\n── Progress Events ───────────────────────────────────');
  for (const e of events) {
    const sub = e.subStep ? ` (${e.subStep})` : '';
    console.log(`  Agent ${e.agent} ${String(e.status).padEnd(12)} ${e.message}${sub}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  Test complete.');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
