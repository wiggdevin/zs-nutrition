/**
 * USDA-Only Pipeline Scoring Module
 *
 * 5-category scoring system for evaluating meal plan quality:
 *   A: Nutritional Accuracy  (30%)
 *   B: Meal Practicality     (25%)
 *   C: Dietary Compliance    (20%)
 *   D: Variety & Experience  (15%)
 *   E: Grocery Feasibility   (10%)
 */

import type { MealPlanValidated, MetabolicProfile, ClientIntake } from '../types/schemas';
import { containsAllergenTerm, isDietaryCompliant } from '../utils/dietary-compliance';

// ============================================================
// Types
// ============================================================

export interface CategoryScore {
  score: number; // 1-10
  weight: number;
  weighted: number;
  evidence: string;
}

export interface ScorecardResult {
  persona: string;
  slug: string;
  pipelineTimeMs: number;
  qaScore: number;
  qaStatus: string;

  categories: {
    nutritionalAccuracy: CategoryScore;
    mealPracticality: CategoryScore;
    dietaryCompliance: CategoryScore;
    variety: CategoryScore;
    groceryFeasibility: CategoryScore;
  };

  composite: number;
  grade: string;

  dailyAdherence: DailyAdherence[];
  ingredientCoverage: IngredientCoverageStats;
  allergenViolations: string[];
  dietaryViolations: string[];
  unmatchedIngredients: string[];
}

export interface DailyAdherence {
  day: number;
  isTrainingDay: boolean;
  targetKcal: number;
  actualKcal: number;
  variancePercent: number;
  targetProtein: number;
  actualProtein: number;
  targetCarbs: number;
  actualCarbs: number;
  targetFat: number;
  actualFat: number;
}

export interface IngredientCoverageStats {
  total: number;
  matchedUSDA: number;
  matchedFatSecret: number;
  unverified: number;
  matchRate: number;
  mealsVerified: number;
  mealsAiEstimated: number;
  totalMeals: number;
}

// ============================================================
// Category A: Nutritional Accuracy (30%)
// ============================================================

function scoreNutritionalAccuracy(
  plan: MealPlanValidated,
  metabolicProfile: MetabolicProfile,
  clientIntake: ClientIntake
): CategoryScore {
  const days = plan.days;
  const trainingDaySet = new Set<string>(clientIntake.trainingDays);
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  let totalKcalError = 0;
  let totalProteinError = 0;
  let totalCarbsError = 0;
  let totalFatError = 0;
  let daysWithin5Pct = 0;
  let _daysWithin10Pct = 0;
  const evidence: string[] = [];

  for (const day of days) {
    const dayName = dayNames[(day.dayNumber - 1) % 7];
    const isTraining = trainingDaySet.has(dayName);
    const targetKcal = isTraining ? metabolicProfile.trainingDayKcal : metabolicProfile.restDayKcal;
    const targetProtein = isTraining
      ? (metabolicProfile.trainingDayMacros?.proteinG ?? metabolicProfile.proteinTargetG)
      : metabolicProfile.proteinTargetG;
    const targetCarbs = isTraining
      ? (metabolicProfile.trainingDayMacros?.carbsG ?? metabolicProfile.carbsTargetG)
      : metabolicProfile.carbsTargetG;
    const targetFat = isTraining
      ? (metabolicProfile.trainingDayMacros?.fatG ?? metabolicProfile.fatTargetG)
      : metabolicProfile.fatTargetG;

    const kcalError = targetKcal > 0 ? Math.abs(day.dailyTotals.kcal - targetKcal) / targetKcal : 0;
    const proteinError =
      targetProtein > 0 ? Math.abs(day.dailyTotals.proteinG - targetProtein) / targetProtein : 0;
    const carbsError =
      targetCarbs > 0 ? Math.abs(day.dailyTotals.carbsG - targetCarbs) / targetCarbs : 0;
    const fatError = targetFat > 0 ? Math.abs(day.dailyTotals.fatG - targetFat) / targetFat : 0;

    totalKcalError += kcalError;
    totalProteinError += proteinError;
    totalCarbsError += carbsError;
    totalFatError += fatError;

    if (kcalError <= 0.05) daysWithin5Pct++;
    if (kcalError <= 0.1) _daysWithin10Pct++;
  }

  const numDays = days.length || 1;
  const avgKcalError = totalKcalError / numDays;
  const avgProteinError = totalProteinError / numDays;
  const avgCarbsError = totalCarbsError / numDays;
  const avgFatError = totalFatError / numDays;

  // Weighted error: kcal 40%, protein 30%, carbs 15%, fat 15%
  const weightedError =
    avgKcalError * 0.4 + avgProteinError * 0.3 + avgCarbsError * 0.15 + avgFatError * 0.15;

  // Score mapping: 0% error = 10, 5% = 8, 10% = 6, 20% = 4, 30%+ = 2, 50%+ = 1
  let score: number;
  if (weightedError <= 0.03) score = 10;
  else if (weightedError <= 0.05) score = 9;
  else if (weightedError <= 0.08) score = 8;
  else if (weightedError <= 0.1) score = 7;
  else if (weightedError <= 0.15) score = 6;
  else if (weightedError <= 0.2) score = 5;
  else if (weightedError <= 0.3) score = 4;
  else if (weightedError <= 0.4) score = 3;
  else if (weightedError <= 0.5) score = 2;
  else score = 1;

  evidence.push(`${daysWithin5Pct}/${numDays} days within 5% kcal target`);
  evidence.push(`Avg kcal error: ${(avgKcalError * 100).toFixed(1)}%`);
  evidence.push(`Avg protein error: ${(avgProteinError * 100).toFixed(1)}%`);
  evidence.push(`Avg carbs error: ${(avgCarbsError * 100).toFixed(1)}%`);
  evidence.push(`Avg fat error: ${(avgFatError * 100).toFixed(1)}%`);

  return {
    score,
    weight: 0.3,
    weighted: score * 0.3,
    evidence: evidence.join('. '),
  };
}

// ============================================================
// Category B: Meal Practicality (25%)
// ============================================================

function scoreMealPracticality(plan: MealPlanValidated, clientIntake: ClientIntake): CategoryScore {
  const evidence: string[] = [];
  let totalIngPerMeal = 0;
  let totalMeals = 0;
  let prepTimeViolations = 0;
  let totalPrepTime = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      totalMeals++;
      totalIngPerMeal += meal.ingredients.length;
      const totalTime = meal.prepTimeMin + meal.cookTimeMin;
      totalPrepTime += totalTime;

      // Check if prep+cook exceeds user's max
      if (totalTime > clientIntake.prepTimeMaxMin * 1.5) {
        prepTimeViolations++;
      }
    }
  }

  const avgIngredients = totalMeals > 0 ? totalIngPerMeal / totalMeals : 0;
  const avgPrepTime = totalMeals > 0 ? totalPrepTime / totalMeals : 0;

  let score = 10;

  // Ingredient count scoring: ideal 4-8 per meal
  if (avgIngredients < 3) score -= 2;
  else if (avgIngredients < 4) score -= 1;
  else if (avgIngredients > 12) score -= 3;
  else if (avgIngredients > 10) score -= 2;
  else if (avgIngredients > 8) score -= 1;

  // Prep time violations
  const violationRate = totalMeals > 0 ? prepTimeViolations / totalMeals : 0;
  if (violationRate > 0.5) score -= 3;
  else if (violationRate > 0.25) score -= 2;
  else if (violationRate > 0.1) score -= 1;

  // Cooking skill alignment: low skill should get simpler meals
  if (clientIntake.cookingSkill <= 3 && avgIngredients > 8) score -= 1;
  if (clientIntake.cookingSkill <= 3 && avgPrepTime > 30) score -= 1;

  score = Math.max(1, Math.min(10, score));

  evidence.push(`${avgIngredients.toFixed(1)} avg ingredients/meal`);
  evidence.push(`${avgPrepTime.toFixed(0)}min avg total cook time`);
  evidence.push(`${prepTimeViolations} meals exceed ${clientIntake.prepTimeMaxMin}min prep limit`);
  evidence.push(`Cooking skill ${clientIntake.cookingSkill}/10`);

  return {
    score,
    weight: 0.25,
    weighted: score * 0.25,
    evidence: evidence.join('. '),
  };
}

// ============================================================
// Category C: Dietary Compliance (20%)
// ============================================================

function scoreDietaryCompliance(
  plan: MealPlanValidated,
  clientIntake: ClientIntake
): { score: CategoryScore; allergenViolations: string[]; dietaryViolations: string[] } {
  const allergenViolations: string[] = [];
  const dietaryViolations: string[] = [];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      // Check meal name
      for (const allergen of clientIntake.allergies) {
        if (containsAllergenTerm(meal.name, allergen)) {
          allergenViolations.push(
            `Day ${day.dayNumber} "${meal.name}": name contains "${allergen}" allergen`
          );
        }
      }
      if (!isDietaryCompliant(meal.name, clientIntake.dietaryStyle)) {
        dietaryViolations.push(
          `Day ${day.dayNumber} "${meal.name}": name violates ${clientIntake.dietaryStyle} diet`
        );
      }

      // Check each ingredient
      for (const ing of meal.ingredients) {
        for (const allergen of clientIntake.allergies) {
          if (containsAllergenTerm(ing.name, allergen)) {
            allergenViolations.push(
              `Day ${day.dayNumber} "${meal.name}": "${ing.name}" contains "${allergen}"`
            );
          }
        }
        if (!isDietaryCompliant(ing.name, clientIntake.dietaryStyle)) {
          dietaryViolations.push(
            `Day ${day.dayNumber} "${meal.name}": "${ing.name}" violates ${clientIntake.dietaryStyle}`
          );
        }
      }
    }
  }

  const totalViolations = allergenViolations.length + dietaryViolations.length;

  // ANY allergen violation = automatic score 1
  let score: number;
  if (allergenViolations.length > 0) {
    score = 1;
  } else if (totalViolations === 0) {
    score = 10;
  } else if (totalViolations <= 2) {
    score = 6;
  } else if (totalViolations <= 5) {
    score = 4;
  } else {
    score = 2;
  }

  const evidence: string[] = [];
  if (totalViolations === 0) {
    evidence.push('Zero violations');
    if (clientIntake.allergies.length > 0) {
      evidence.push(`Allergies (${clientIntake.allergies.join(', ')}) fully respected`);
    }
    evidence.push(`${clientIntake.dietaryStyle} diet fully respected`);
  } else {
    evidence.push(`${allergenViolations.length} allergen violations`);
    evidence.push(`${dietaryViolations.length} dietary style violations`);
  }

  return {
    score: {
      score,
      weight: 0.2,
      weighted: score * 0.2,
      evidence: evidence.join('. '),
    },
    allergenViolations,
    dietaryViolations,
  };
}

// ============================================================
// Category D: Variety & Experience (15%)
// ============================================================

function scoreVariety(plan: MealPlanValidated): CategoryScore {
  const evidence: string[] = [];
  const proteinsByDay: Map<number, string[]> = new Map();
  const allCuisines = new Set<string>();
  const allMealNames = new Set<string>();
  const allProteins = new Set<string>();
  let consecutiveProteinRepeats = 0;

  for (const day of plan.days) {
    const dayProteins: string[] = [];
    for (const meal of day.meals) {
      allMealNames.add(meal.name.toLowerCase());
      allCuisines.add(meal.cuisine.toLowerCase());
      if (meal.primaryProtein) {
        allProteins.add(meal.primaryProtein.toLowerCase());
        dayProteins.push(meal.primaryProtein.toLowerCase());
      }
    }
    proteinsByDay.set(day.dayNumber, dayProteins);
  }

  // Check consecutive-day protein repeats
  const sortedDays = [...proteinsByDay.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sortedDays.length; i++) {
    const prevProteins = new Set(sortedDays[i - 1][1]);
    const currProteins = sortedDays[i][1];
    for (const p of currProteins) {
      if (prevProteins.has(p)) {
        consecutiveProteinRepeats++;
      }
    }
  }

  // Check 3-day window meal uniqueness
  let threeDayRepeats = 0;
  const dayMealNames: string[][] = plan.days.map((d) => d.meals.map((m) => m.name.toLowerCase()));
  for (let i = 0; i < dayMealNames.length; i++) {
    const windowNames = new Set<string>();
    const windowStart = Math.max(0, i - 2);
    for (let j = windowStart; j < i; j++) {
      dayMealNames[j].forEach((n) => windowNames.add(n));
    }
    for (const name of dayMealNames[i]) {
      if (windowNames.has(name)) threeDayRepeats++;
    }
  }

  let score = 10;

  // Protein diversity: ideal 5+ distinct proteins
  if (allProteins.size < 3) score -= 3;
  else if (allProteins.size < 5) score -= 1;

  // Cuisine diversity: ideal 3+
  if (allCuisines.size < 2) score -= 2;
  else if (allCuisines.size < 3) score -= 1;

  // Consecutive protein repeats penalty
  if (consecutiveProteinRepeats > 6) score -= 3;
  else if (consecutiveProteinRepeats > 3) score -= 2;
  else if (consecutiveProteinRepeats > 1) score -= 1;

  // 3-day window repeat penalty
  if (threeDayRepeats > 5) score -= 2;
  else if (threeDayRepeats > 2) score -= 1;

  score = Math.max(1, Math.min(10, score));

  evidence.push(`${allProteins.size} distinct proteins`);
  evidence.push(`${allCuisines.size} cuisines`);
  evidence.push(`${allMealNames.size} unique meals`);
  evidence.push(`${consecutiveProteinRepeats} consecutive-day protein repeats`);
  evidence.push(`${threeDayRepeats} 3-day-window meal repeats`);

  return {
    score,
    weight: 0.15,
    weighted: score * 0.15,
    evidence: evidence.join('. '),
  };
}

// ============================================================
// Category E: Grocery Feasibility (10%)
// ============================================================

function scoreGroceryFeasibility(plan: MealPlanValidated): CategoryScore {
  const evidence: string[] = [];

  // Count unique ingredients across entire plan
  const ingredientCounts = new Map<string, number>();
  let totalIngredientUses = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase().trim();
        ingredientCounts.set(key, (ingredientCounts.get(key) || 0) + 1);
        totalIngredientUses++;
      }
    }
  }

  const uniqueCount = ingredientCounts.size;
  const reuseRatio = totalIngredientUses > 0 ? totalIngredientUses / uniqueCount : 0;

  // Also check grocery list if available
  let groceryItems = 0;
  if (plan.groceryList) {
    for (const cat of plan.groceryList) {
      groceryItems += cat.items.length;
    }
  }

  let score = 10;

  // Unique ingredients: ideal 25-45 for 7-day plan
  if (uniqueCount > 80) score -= 4;
  else if (uniqueCount > 60) score -= 3;
  else if (uniqueCount > 50) score -= 2;
  else if (uniqueCount > 45) score -= 1;
  else if (uniqueCount < 15) score -= 2;
  else if (uniqueCount < 20) score -= 1;

  // Reuse ratio: higher is better (ingredients used multiple times)
  if (reuseRatio < 1.5) score -= 2;
  else if (reuseRatio < 2.0) score -= 1;

  score = Math.max(1, Math.min(10, score));

  evidence.push(`${uniqueCount} unique ingredients`);
  evidence.push(`${totalIngredientUses} total uses (${reuseRatio.toFixed(1)}x reuse)`);
  if (groceryItems > 0) {
    evidence.push(`${groceryItems} grocery list items`);
  }

  return {
    score,
    weight: 0.1,
    weighted: score * 0.1,
    evidence: evidence.join('. '),
  };
}

// ============================================================
// Coverage Extraction
// ============================================================

export function extractIngredientCoverage(plan: MealPlanValidated): IngredientCoverageStats {
  const stats: IngredientCoverageStats = {
    total: 0,
    matchedUSDA: 0,
    matchedFatSecret: 0,
    unverified: 0,
    matchRate: 0,
    mealsVerified: 0,
    mealsAiEstimated: 0,
    totalMeals: 0,
  };

  for (const day of plan.days) {
    for (const meal of day.meals) {
      stats.totalMeals++;
      if (meal.confidenceLevel === 'verified') {
        stats.mealsVerified++;
      } else {
        stats.mealsAiEstimated++;
      }

      for (const ing of meal.ingredients) {
        stats.total++;
        if (ing.foodId) {
          if (ing.foodId.startsWith('usda-')) {
            stats.matchedUSDA++;
          } else if (ing.foodId.startsWith('fatsecret-')) {
            stats.matchedFatSecret++;
          } else {
            stats.matchedFatSecret++; // legacy unprefixed IDs treated as FatSecret
          }
        } else {
          stats.unverified++;
        }
      }
    }
  }

  const matched = stats.matchedUSDA + stats.matchedFatSecret;
  stats.matchRate = stats.total > 0 ? matched / stats.total : 0;

  return stats;
}

export function extractUnmatchedIngredients(plan: MealPlanValidated): string[] {
  const unmatched: string[] = [];
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        if (!ing.foodId) {
          unmatched.push(ing.name);
        }
      }
    }
  }
  return [...new Set(unmatched)];
}

// ============================================================
// Daily Adherence Extraction
// ============================================================

export function extractDailyAdherence(
  plan: MealPlanValidated,
  metabolicProfile: MetabolicProfile,
  clientIntake: ClientIntake
): DailyAdherence[] {
  const trainingDaySet = new Set<string>(clientIntake.trainingDays);
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return plan.days.map((day) => {
    const dayName = dayNames[(day.dayNumber - 1) % 7];
    const isTraining = trainingDaySet.has(dayName);
    const targetKcal = isTraining ? metabolicProfile.trainingDayKcal : metabolicProfile.restDayKcal;
    const targetProtein = isTraining
      ? (metabolicProfile.trainingDayMacros?.proteinG ?? metabolicProfile.proteinTargetG)
      : metabolicProfile.proteinTargetG;
    const targetCarbs = isTraining
      ? (metabolicProfile.trainingDayMacros?.carbsG ?? metabolicProfile.carbsTargetG)
      : metabolicProfile.carbsTargetG;
    const targetFat = isTraining
      ? (metabolicProfile.trainingDayMacros?.fatG ?? metabolicProfile.fatTargetG)
      : metabolicProfile.fatTargetG;

    const variancePercent =
      targetKcal > 0 ? ((day.dailyTotals.kcal - targetKcal) / targetKcal) * 100 : 0;

    return {
      day: day.dayNumber,
      isTrainingDay: isTraining,
      targetKcal,
      actualKcal: day.dailyTotals.kcal,
      variancePercent: Math.round(variancePercent * 10) / 10,
      targetProtein,
      actualProtein: day.dailyTotals.proteinG,
      targetCarbs,
      actualCarbs: day.dailyTotals.carbsG,
      targetFat,
      actualFat: day.dailyTotals.fatG,
    };
  });
}

// ============================================================
// Composite Scoring
// ============================================================

function gradeFromComposite(composite: number): string {
  if (composite >= 9.0) return 'Excellent';
  if (composite >= 7.5) return 'Good';
  if (composite >= 6.0) return 'Fair';
  if (composite >= 4.0) return 'Poor';
  return 'Failing';
}

export function scorePlan(
  plan: MealPlanValidated,
  metabolicProfile: MetabolicProfile,
  clientIntake: ClientIntake,
  personaName: string,
  personaSlug: string,
  pipelineTimeMs: number
): ScorecardResult {
  const catA = scoreNutritionalAccuracy(plan, metabolicProfile, clientIntake);
  const catB = scoreMealPracticality(plan, clientIntake);
  const {
    score: catC,
    allergenViolations,
    dietaryViolations,
  } = scoreDietaryCompliance(plan, clientIntake);
  const catD = scoreVariety(plan);
  const catE = scoreGroceryFeasibility(plan);

  const composite = catA.weighted + catB.weighted + catC.weighted + catD.weighted + catE.weighted;
  const grade = gradeFromComposite(composite);

  return {
    persona: personaName,
    slug: personaSlug,
    pipelineTimeMs,
    qaScore: plan.qa.score,
    qaStatus: plan.qa.status,
    categories: {
      nutritionalAccuracy: catA,
      mealPracticality: catB,
      dietaryCompliance: catC,
      variety: catD,
      groceryFeasibility: catE,
    },
    composite: Math.round(composite * 100) / 100,
    grade,
    dailyAdherence: extractDailyAdherence(plan, metabolicProfile, clientIntake),
    ingredientCoverage: extractIngredientCoverage(plan),
    allergenViolations,
    dietaryViolations,
    unmatchedIngredients: extractUnmatchedIngredients(plan),
  };
}
