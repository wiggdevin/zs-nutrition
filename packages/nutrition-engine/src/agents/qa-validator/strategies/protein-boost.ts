import type { CompiledDay, ClientIntake } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

const PROTEIN_DENSE_KEYWORDS = [
  'chicken',
  'turkey',
  'beef',
  'pork',
  'fish',
  'salmon',
  'tuna',
  'cod',
  'shrimp',
  'tilapia',
  'tofu',
  'tempeh',
  'seitan',
  'egg',
  'whey',
  'greek yogurt',
  'cottage cheese',
  'lentil',
  'chickpea',
];

const FAT_DENSE_KEYWORDS = [
  'oil',
  'butter',
  'ghee',
  'cream',
  'mayo',
  'mayonnaise',
  'avocado',
  'cheese',
  'coconut',
  'lard',
  'bacon',
  'sour cream',
];

function isProteinDense(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTEIN_DENSE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isFatDense(name: string): boolean {
  const lower = name.toLowerCase();
  return FAT_DENSE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Protein-boost repair strategy: scales protein-dense ingredients UP
 * and fat-dense ingredients DOWN to fix protein undershoot / fat overshoot.
 * Only activates for macro violations involving protein.
 */
export const proteinBoost: RepairStrategy = {
  name: 'protein-boost',

  attempt(
    day: CompiledDay,
    violation: Violation,
    _clientIntake?: ClientIntake
  ): RepairResult | null {
    if (violation.type !== 'macro') return null;
    if (!violation.offendingMacros?.includes('protein')) return null;
    if (!day.macroTargets) return null;

    const proteinTarget = day.macroTargets.proteinG;
    const proteinActual = day.dailyTotals.proteinG;
    if (proteinActual >= proteinTarget * 0.9) return null; // within 10%, skip

    const newMeals = day.meals.map((meal) => {
      const mealProtein = meal.nutrition.proteinG;
      const mealFat = meal.nutrition.fatG;

      // Find protein and fat ingredients
      const hasProteinIng = meal.ingredients.some((ing) => isProteinDense(ing.name));
      const hasFatIng = meal.ingredients.some((ing) => isFatDense(ing.name));

      if (!hasProteinIng) return meal;

      // Scale protein sources up (max 1.3x)
      const proteinScale = Math.min(1.3, proteinTarget / Math.max(1, proteinActual));
      // Scale fat sources down (min 0.7x) if fat is also over target
      const fatTarget = day.macroTargets!.fatG;
      const fatActual = day.dailyTotals.fatG;
      const fatScale =
        hasFatIng && fatActual > fatTarget * 1.1
          ? Math.max(0.7, fatTarget / Math.max(1, fatActual))
          : 1.0;

      const newIngredients = meal.ingredients.map((ing) => {
        if (isProteinDense(ing.name)) {
          return { ...ing, amount: Math.round(ing.amount * proteinScale * 100) / 100 };
        }
        if (isFatDense(ing.name)) {
          return { ...ing, amount: Math.round(ing.amount * fatScale * 100) / 100 };
        }
        return ing;
      });

      // Recalculate nutrition
      const newProtein = Math.round(mealProtein * proteinScale * 10) / 10;
      const newFat = Math.round(mealFat * fatScale * 10) / 10;
      const newKcal = Math.round(newProtein * 4 + meal.nutrition.carbsG * 4 + newFat * 9);

      return {
        ...meal,
        ingredients: newIngredients,
        nutrition: {
          ...meal.nutrition,
          kcal: newKcal,
          proteinG: newProtein,
          fatG: newFat,
        },
      };
    });

    const newTotals = recalcDailyTotals(newMeals);

    // Verify improvement: new protein should be closer to target
    if (newTotals.proteinG <= proteinActual) return null;

    const newVarianceKcal = newTotals.kcal - day.targetKcal;
    const newVariancePercent =
      day.targetKcal > 0 ? Math.round((newVarianceKcal / day.targetKcal) * 10000) / 100 : 0;

    return {
      adjustedDay: {
        ...day,
        meals: newMeals,
        dailyTotals: newTotals,
        varianceKcal: Math.round(newVarianceKcal),
        variancePercent: newVariancePercent,
      },
      description: `Day ${day.dayNumber}: [protein-boost] Scaled protein sources up, fat sources down. Protein: ${Math.round(proteinActual)}g → ${Math.round(newTotals.proteinG)}g`,
    };
  },
};
