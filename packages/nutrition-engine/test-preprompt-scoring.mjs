import { NutritionPipelineOrchestrator } from './dist/index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
];

const results = [];

for (const persona of personas) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RUNNING: ${persona.name}`);
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

  results.push({
    name: persona.name,
    success: output.success,
    timeMs: elapsed,
    qaScore: output.qaScore,
    qaStatus: output.qaStatus,
  });

  // Save individual result
  const filename = `preprompt-test-${persona.name.toLowerCase()}.json`;
  writeFileSync(join(OUTPUT_DIR, filename), JSON.stringify(output, null, 2));
  console.log(`\n>> Saved ${filename} (${output.success ? 'SUCCESS' : 'FAILED'}, ${(elapsed / 1000).toFixed(1)}s)`);

  if (output.success) {
    const plan = output.plan;
    console.log(`   QA: ${plan.qa.status} | Score: ${plan.qa.score}/100`);
    for (const day of plan.days) {
      console.log(`   ${day.dayName}: target ${day.targetKcal} kcal, actual ${day.dailyTotals.kcal} kcal (${day.variancePercent >= 0 ? '+' : ''}${day.variancePercent.toFixed(1)}%)`);
    }
  }
}

// Save summary
const successRuns = results.filter(r => r.success);
const summary = {
  testName: 'preprompt-scoring-v1',
  timestamp: new Date().toISOString(),
  personas: results,
  successCount: successRuns.length,
  failCount: results.length - successRuns.length,
  avgTimeMs: successRuns.length > 0
    ? Math.round(successRuns.reduce((s, r) => s + r.timeMs, 0) / successRuns.length)
    : 0,
};

writeFileSync(join(OUTPUT_DIR, 'preprompt-test-summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n${'='.repeat(60)}`);
console.log(`  SUMMARY: ${summary.successCount}/${results.length} passed`);
console.log(`  Avg time: ${(summary.avgTimeMs / 1000).toFixed(1)}s`);
for (const r of results) {
  console.log(`  ${r.name}: ${r.success ? `QA ${r.qaScore}/100 (${r.qaStatus})` : 'FAILED'} — ${(r.timeMs / 1000).toFixed(1)}s`);
}
console.log(`${'='.repeat(60)}`);
