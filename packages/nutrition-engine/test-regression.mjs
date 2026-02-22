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
    name: 'Elena', sex: 'female', age: 33,
    heightFeet: 5, heightInches: 4, weightLbs: 170,
    goalType: 'cut', goalRate: 2.0, activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
    dietaryStyle: 'pescatarian', allergies: ['dairy', 'gluten'], exclusions: [],
    cuisinePreferences: ['mediterranean', 'greek'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 6,
    prepTimeMaxMin: 30, macroStyle: 'balanced', planDurationDays: 7,
  },
  {
    name: 'Jamal', sex: 'male', age: 22,
    heightFeet: 6, heightInches: 2, weightLbs: 210,
    goalType: 'bulk', goalRate: 1.0, activityLevel: 'extremely_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    trainingTime: 'afternoon',
    dietaryStyle: 'paleo', allergies: [], exclusions: [],
    cuisinePreferences: ['american', 'caribbean'],
    mealsPerDay: 4, snacksPerDay: 2, cookingSkill: 7,
    prepTimeMaxMin: 45, macroStyle: 'high_protein', planDurationDays: 7,
  },
  {
    name: 'MinJi', sex: 'female', age: 30,
    heightFeet: 5, heightInches: 6, weightLbs: 140,
    goalType: 'maintain', goalRate: 0, activityLevel: 'lightly_active',
    trainingDays: ['tuesday', 'thursday', 'saturday'],
    dietaryStyle: 'vegetarian', allergies: ['soy'], exclusions: [],
    cuisinePreferences: ['korean', 'japanese', 'mediterranean'],
    mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 8,
    prepTimeMaxMin: 40, macroStyle: 'low_carb', planDurationDays: 7,
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
  const filename = `regression-test-${persona.name.toLowerCase()}.json`;
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
  testName: 'regression-test',
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

writeFileSync(join(OUTPUT_DIR, 'regression-test-summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n${'='.repeat(60)}`);
console.log(`  REGRESSION TEST SUMMARY`);
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
