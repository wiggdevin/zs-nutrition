import type { CompiledDay, CompiledMeal } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

interface SubstitutionEntry {
  from: string;
  to: string;
  /** Additional protein grams per typical serving unit */
  proteinBoostPerUnit: number;
  /** Kcal change per typical serving unit (can be negative or positive) */
  kcalDelta: number;
}

/**
 * Substitution map for fixing protein deficits.
 * Each entry maps a lower-protein ingredient to a higher-protein alternative.
 * The proteinBoostPerUnit is approximate per standard serving.
 */
const PROTEIN_SUBSTITUTIONS: SubstitutionEntry[] = [
  { from: 'white rice', to: 'quinoa', proteinBoostPerUnit: 4, kcalDelta: -10 },
  { from: 'rice', to: 'quinoa', proteinBoostPerUnit: 4, kcalDelta: -10 },
  { from: 'pasta', to: 'lentil pasta', proteinBoostPerUnit: 12, kcalDelta: -5 },
  { from: 'regular bread', to: 'protein bread', proteinBoostPerUnit: 6, kcalDelta: -20 },
  { from: 'bread', to: 'protein bread', proteinBoostPerUnit: 6, kcalDelta: -20 },
  { from: 'regular yogurt', to: 'greek yogurt', proteinBoostPerUnit: 8, kcalDelta: -30 },
  { from: 'yogurt', to: 'greek yogurt', proteinBoostPerUnit: 8, kcalDelta: -30 },
  { from: 'cream cheese', to: 'cottage cheese', proteinBoostPerUnit: 10, kcalDelta: -50 },
];

/**
 * Ingredient substitution: swap ingredients to fix protein-specific macro violations.
 * Only triggers when protein is one of the offending macros and the deficit direction
 * indicates the day needs more protein.
 */
export const ingredientSubstitution: RepairStrategy = {
  name: 'ingredient-substitution',

  attempt(day: CompiledDay, violation: Violation): RepairResult | null {
    // Only handle macro violations where protein is offending
    if (violation.type !== 'macro') {
      return null;
    }

    if (!violation.offendingMacros || !violation.offendingMacros.includes('protein')) {
      return null;
    }

    if (!day.macroTargets) {
      return null;
    }

    // Only trigger for protein deficit (actual < target)
    const proteinDeficit = day.macroTargets.proteinG - day.dailyTotals.proteinG;
    if (proteinDeficit <= 0) {
      return null;
    }

    // Try substitutions across all meals
    let totalProteinAdded = 0;
    let totalKcalDelta = 0;
    const substitutionsMade: string[] = [];
    const newMeals: CompiledMeal[] = day.meals.map((meal) => {
      const newIngredients = meal.ingredients.map((ing) => {
        const nameLower = ing.name.toLowerCase().trim();
        const sub = PROTEIN_SUBSTITUTIONS.find((s) => nameLower.includes(s.from));
        if (!sub) {
          return ing;
        }

        // Avoid duplicate substitutions of the same type
        if (nameLower.includes(sub.to.toLowerCase())) {
          return ing;
        }

        totalProteinAdded += sub.proteinBoostPerUnit;
        totalKcalDelta += sub.kcalDelta;
        substitutionsMade.push(`${ing.name} -> ${sub.to}`);

        return {
          ...ing,
          name: sub.to,
        };
      });

      if (substitutionsMade.length === 0) {
        return meal;
      }

      // Recalculate meal nutrition with substitution adjustments
      const proteinDelta = totalProteinAdded;
      const kcalDelta = totalKcalDelta;

      return {
        ...meal,
        ingredients: newIngredients,
        nutrition: {
          ...meal.nutrition,
          kcal: Math.max(0, meal.nutrition.kcal + kcalDelta),
          proteinG: Math.round((meal.nutrition.proteinG + proteinDelta) * 10) / 10,
        },
      };
    });

    if (substitutionsMade.length === 0) {
      return null;
    }

    const newTotals = recalcDailyTotals(newMeals);
    const targetKcal = day.targetKcal;
    const newVarianceKcal = newTotals.kcal - targetKcal;
    const newVariancePercent =
      targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

    const adjustedDay: CompiledDay = {
      ...day,
      meals: newMeals,
      dailyTotals: newTotals,
      varianceKcal: Math.round(newVarianceKcal),
      variancePercent: newVariancePercent,
    };

    return {
      adjustedDay,
      description: `Day ${day.dayNumber}: [ingredient-substitution] Swapped ${substitutionsMade.join(', ')} (+${Math.round(totalProteinAdded)}g protein)`,
    };
  },
};
