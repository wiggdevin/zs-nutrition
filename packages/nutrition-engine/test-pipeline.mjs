import { NutritionPipelineOrchestrator } from './dist/index.js';

const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  fatsecretClientId: process.env.FATSECRET_CLIENT_ID,
  fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET,
  usdaApiKey: process.env.USDA_API_KEY,
};

const testInput = {
  name: 'Test User', sex: 'male', age: 28,
  heightFeet: 5, heightInches: 11, weightLbs: 195, bodyFatPercent: 20,
  goalType: 'cut', goalRate: 0.75, activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
  trainingTime: 'morning', dietaryStyle: 'omnivore',
  allergies: ['shellfish'], exclusions: ['tofu'],
  cuisinePreferences: ['Asian', 'Mexican', 'Mediterranean'],
  mealsPerDay: 3, snacksPerDay: 1, cookingSkill: 7,
  prepTimeMaxMin: 45, macroStyle: 'high_protein', planDurationDays: 3,
};

const orchestrator = new NutritionPipelineOrchestrator(config);
const startTime = Date.now();
const result = await orchestrator.run(testInput, (p) => {
  console.log(`[${((Date.now()-startTime)/1000).toFixed(1)}s] Agent ${p.agent}: ${p.message}`);
});

if (result.success) {
  const plan = result.plan;
  console.log(`\nQA: ${plan.qa.status} | Score: ${plan.qa.score}/100\n`);
  let v=0, e=0;
  for (const day of plan.days) {
    console.log(`${day.dayName} | Target: ${day.targetKcal} kcal | Actual: ${day.dailyTotals.kcal} kcal (${day.variancePercent.toFixed(1)}%)`);
    for (const meal of day.meals) {
      const tag = meal.confidenceLevel === 'verified' ? 'API' : 'EST';
      if (tag==='API') v++; else e++;
      console.log(`  [${tag}] ${meal.slot}: ${meal.nutrition.kcal} kcal (${meal.name})`);
    }
  }
  console.log(`\n${v} API-verified, ${e} AI-estimated`);
} else {
  console.log('FAILED:', result.error);
}
console.log(`Time: ${((Date.now()-startTime)/1000).toFixed(1)}s`);
