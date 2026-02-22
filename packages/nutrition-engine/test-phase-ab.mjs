import { NutritionPipelineOrchestrator } from './dist/index.js';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Load env vars from root .env
const envPath = join(import.meta.dirname, '..', '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  fatsecretClientId: process.env.FATSECRET_CLIENT_ID,
  fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET,
  usdaApiKey: process.env.USDA_API_KEY,
};

const OUTPUT_DIR = join(import.meta.dirname, '..', '..', '..', 'NE Implementation', 'Nutrition Engine testing:validation');

const personas = [
  {
    name: 'Marcus', sex: 'male', age: 32,
    heightFeet: 5, heightInches: 10, weightLbs: 195,
    goalType: 'cut', goalRate: 1.5, activityLevel: 'sedentary',
    trainingDays: ['monday', 'wednesday', 'friday'],
    dietaryStyle: 'omnivore', allergies: [], exclusions: [],
    cuisinePreferences: ['american', 'mediterranean'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 4,
    prepTimeMaxMin: 20, macroStyle: 'high_protein', planDurationDays: 7,
  },
  {
    name: 'Kayla', sex: 'female', age: 21,
    heightFeet: 5, heightInches: 7, weightLbs: 145,
    goalType: 'bulk', goalRate: 0.5, activityLevel: 'extremely_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore', allergies: [], exclusions: [],
    cuisinePreferences: ['american', 'mexican', 'asian'],
    mealsPerDay: 4, snacksPerDay: 2, cookingSkill: 4,
    prepTimeMaxMin: 20, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Raj', sex: 'male', age: 28,
    heightCm: 180, weightKg: 72,
    goalType: 'maintain', goalRate: 0, activityLevel: 'very_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    trainingTime: 'morning',
    dietaryStyle: 'vegan', allergies: ['soy'], exclusions: [],
    cuisinePreferences: ['mediterranean', 'indian', 'thai'],
    mealsPerDay: 3, snacksPerDay: 2, cookingSkill: 7,
    prepTimeMaxMin: 45, macroStyle: 'high_protein', planDurationDays: 7,
  },
  {
    name: 'Jennifer', sex: 'female', age: 38,
    heightFeet: 5, heightInches: 5, weightLbs: 160,
    goalType: 'cut', goalRate: 1.0, activityLevel: 'lightly_active',
    trainingDays: ['tuesday', 'thursday', 'saturday'],
    dietaryStyle: 'omnivore', allergies: ['dairy'], exclusions: [],
    cuisinePreferences: ['american', 'mexican'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 6,
    prepTimeMaxMin: 30, macroStyle: 'keto', planDurationDays: 7,
  },
  {
    name: 'Robert', sex: 'male', age: 67,
    heightFeet: 5, heightInches: 9, weightLbs: 180,
    goalType: 'maintain', goalRate: 0, activityLevel: 'sedentary',
    trainingDays: [],
    dietaryStyle: 'omnivore', allergies: ['peanut', 'tree nut', 'shellfish', 'gluten'],
    exclusions: [],
    cuisinePreferences: ['american', 'italian', 'greek'],
    mealsPerDay: 3, snacksPerDay: 0, cookingSkill: 5,
    prepTimeMaxMin: 40, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Sarah', sex: 'female', age: 24,
    heightFeet: 5, heightInches: 2, weightLbs: 130,
    goalType: 'cut', goalRate: 2.0, activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
    dietaryStyle: 'omnivore', allergies: [], exclusions: [],
    cuisinePreferences: ['mediterranean', 'asian'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 5,
    prepTimeMaxMin: 25, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Takeshi', sex: 'male', age: 29,
    heightCm: 178, weightKg: 85, bodyFatPercent: 14,
    goalType: 'bulk', goalRate: 0.5, activityLevel: 'very_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    trainingTime: 'afternoon',
    dietaryStyle: 'pescatarian', allergies: [], exclusions: [],
    cuisinePreferences: ['japanese', 'mediterranean', 'thai'],
    mealsPerDay: 5, snacksPerDay: 1, cookingSkill: 8,
    prepTimeMaxMin: 60, macroStyle: 'high_protein', planDurationDays: 7,
  },
  {
    name: 'Diane', sex: 'female', age: 45,
    heightFeet: 5, heightInches: 6, weightLbs: 155,
    goalType: 'maintain', goalRate: 0, activityLevel: 'lightly_active',
    trainingDays: ['tuesday', 'thursday'],
    dietaryStyle: 'omnivore', allergies: ['egg'], exclusions: [],
    cuisinePreferences: ['american', 'italian'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 2,
    prepTimeMaxMin: 15, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Priya', sex: 'female', age: 18,
    heightCm: 163, weightKg: 54,
    goalType: 'maintain', goalRate: 0, activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday'],
    dietaryStyle: 'vegetarian', allergies: [], exclusions: [],
    cuisinePreferences: ['indian', 'mediterranean'],
    mealsPerDay: 3, snacksPerDay: 2, cookingSkill: 6,
    prepTimeMaxMin: 30, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Darius', sex: 'male', age: 25,
    heightFeet: 6, heightInches: 4, weightLbs: 240,
    goalType: 'bulk', goalRate: 2.0, activityLevel: 'extremely_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    trainingTime: 'afternoon',
    dietaryStyle: 'omnivore', allergies: [], exclusions: [],
    cuisinePreferences: ['american', 'mexican', 'italian'],
    mealsPerDay: 5, snacksPerDay: 2, cookingSkill: 5,
    prepTimeMaxMin: 30, macroStyle: 'high_protein', planDurationDays: 7,
  },
];

const results = [];

for (const persona of personas) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RUNNING: ${persona.name} (${results.length + 1}/${personas.length})`);
  console.log(`${'='.repeat(60)}\n`);

  const orchestrator = new NutritionPipelineOrchestrator(config);
  const startTime = Date.now();
  let result;

  try {
    result = await orchestrator.run(persona, (p) => {
      console.log(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] Agent ${p.agent}: ${p.message}`);
    });
  } catch (err) {
    result = { success: false, error: err.message, plan: null };
  }

  const elapsed = Date.now() - startTime;

  const output = {
    persona: persona.name,
    timestamp: new Date().toISOString(),
    rawInput: persona,
    pipelineTimeMs: elapsed,
    success: result.success,
    error: result.success ? null : (result.error || 'Unknown error'),
    qaScore: result.success ? result.plan.qa.score : null,
    qaStatus: result.success ? result.plan.qa.status : null,
    plan: result.success ? result.plan : null,
  };

  // Enhanced analysis for successful runs
  let complianceWarnings = 0;
  let daysWithinTolerance = 0;
  let qaAdjustmentCount = 0;

  if (output.success) {
    const plan = output.plan;

    // Count compliance warnings
    if (plan.qa && plan.qa.adjustmentsMade) {
      complianceWarnings = plan.qa.adjustmentsMade.filter(a => a.includes('[COMPLIANCE]')).length;
      qaAdjustmentCount = plan.qa.adjustmentsMade.length;
    }

    // Count days within ±3% tolerance
    for (const day of plan.days) {
      if (Math.abs(day.variancePercent) <= 3.0) {
        daysWithinTolerance++;
      }
    }
  }

  results.push({
    name: persona.name,
    success: output.success,
    timeMs: elapsed,
    qaScore: output.qaScore,
    qaStatus: output.qaStatus,
    daysWithinTolerance,
    complianceWarnings,
    qaAdjustmentCount,
  });

  // Save individual result
  const filename = `phase-ab-test-${persona.name.toLowerCase()}.json`;
  writeFileSync(join(OUTPUT_DIR, filename), JSON.stringify(output, null, 2));
  console.log(`\n>> Saved ${filename} (${output.success ? 'SUCCESS' : 'FAILED'}, ${(elapsed / 1000).toFixed(1)}s)`);

  if (output.success) {
    const plan = output.plan;
    console.log(`   QA: ${plan.qa.status} | Score: ${plan.qa.score}/100`);
    console.log(`   Days within ±3%: ${daysWithinTolerance}/7`);
    console.log(`   Compliance warnings: ${complianceWarnings}`);
    console.log(`   Total QA adjustments: ${qaAdjustmentCount}`);
    for (const day of plan.days) {
      const marker = Math.abs(day.variancePercent) <= 3.0 ? '✓' : '✗';
      console.log(`   ${marker} ${day.dayName}: target ${day.targetKcal} kcal, actual ${day.dailyTotals.kcal} kcal (${day.variancePercent >= 0 ? '+' : ''}${day.variancePercent.toFixed(1)}%)`);
    }
  }
}

// Save summary
const successRuns = results.filter(r => r.success);
const summary = {
  testName: 'phase-ab-test',
  timestamp: new Date().toISOString(),
  personas: results,
  successCount: successRuns.length,
  failCount: results.length - successRuns.length,
  avgTimeMs: successRuns.length > 0
    ? Math.round(successRuns.reduce((s, r) => s + r.timeMs, 0) / successRuns.length)
    : 0,
  avgDaysWithinTolerance: successRuns.length > 0
    ? (successRuns.reduce((s, r) => s + r.daysWithinTolerance, 0) / successRuns.length).toFixed(2)
    : 0,
  totalComplianceWarnings: results.reduce((s, r) => s + r.complianceWarnings, 0),
};

writeFileSync(join(OUTPUT_DIR, 'phase-ab-test-summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n${'='.repeat(60)}`);
console.log(`  PHASE A+B TEST SUMMARY`);
console.log(`${'='.repeat(60)}`);
console.log(`  Passed: ${summary.successCount}/${results.length}`);
console.log(`  Avg time: ${(summary.avgTimeMs / 1000).toFixed(1)}s`);
console.log(`  Avg days within ±3%: ${summary.avgDaysWithinTolerance}/7`);
console.log(`  Total compliance warnings: ${summary.totalComplianceWarnings}`);
console.log(`${'─'.repeat(60)}`);
for (const r of results) {
  if (r.success) {
    console.log(`  ${r.name}: QA ${r.qaScore}/100 (${r.qaStatus}) | ±3%: ${r.daysWithinTolerance}/7 | Compliance: ${r.complianceWarnings} warns | ${(r.timeMs / 1000).toFixed(1)}s`);
  } else {
    console.log(`  ${r.name}: FAILED — ${(r.timeMs / 1000).toFixed(1)}s`);
  }
}
console.log(`${'='.repeat(60)}`);
