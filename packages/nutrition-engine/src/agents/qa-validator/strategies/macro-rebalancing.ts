import type { CompiledDay, CompiledMeal, Ingredient, ClientIntake } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

/**
 * Classify a compiled ingredient as protein-dominant, carb-dominant,
 * fat-dominant, or other based on its name.
 * Uses the same heuristic keywords as draft-macro-corrector.
 */
type MacroClass = 'protein' | 'carb' | 'fat' | 'other';

const PROTEIN_KEYWORDS = [
  'chicken',
  'turkey',
  'beef',
  'steak',
  'pork',
  'lamb',
  'salmon',
  'tuna',
  'cod',
  'tilapia',
  'shrimp',
  'prawn',
  'fish',
  'egg',
  'tofu',
  'tempeh',
  'greek yogurt',
  'cottage cheese',
  'whey',
  'protein powder',
  'haddock',
  'halibut',
  'sole',
  'white fish',
];

const CARB_KEYWORDS = [
  'rice',
  'quinoa',
  'oats',
  'oatmeal',
  'pasta',
  'spaghetti',
  'noodle',
  'bread',
  'toast',
  'tortilla',
  'wrap',
  'potato',
  'sweet potato',
  'lentil',
  'chickpea',
  'bean',
  'banana',
  'apple',
  'berries',
  'blueberry',
  'strawberry',
  'honey',
  'maple syrup',
  'corn',
  'cereal',
  'granola',
  'pita',
  'couscous',
];

const FAT_KEYWORDS = [
  'oil',
  'butter',
  'ghee',
  'avocado',
  'almond',
  'walnut',
  'peanut butter',
  'nut butter',
  'cheese',
  'cheddar',
  'mozzarella',
  'cream cheese',
  'heavy cream',
  'cream',
  'coconut milk',
  'bacon',
  'pecan',
  'macadamia',
  'chia',
  'flax',
  'seed',
];

function classifyIngredient(name: string): MacroClass {
  const lower = name.toLowerCase();
  for (const kw of PROTEIN_KEYWORDS) {
    if (lower.includes(kw)) return 'protein';
  }
  for (const CARB of CARB_KEYWORDS) {
    if (lower.includes(CARB)) return 'carb';
  }
  for (const kw of FAT_KEYWORDS) {
    if (lower.includes(kw)) return 'fat';
  }
  return 'other';
}

/**
 * Macro-rebalancing repair strategy.
 *
 * Unlike proportional scaling (which scales ALL macros uniformly and preserves
 * the wrong ratio), this strategy adjusts each offending macro independently
 * by scaling only the ingredients in that macro category.
 *
 * For example, if protein is 20% under target but carbs are on target:
 * - Scale up protein-dominant ingredients (chicken, fish, etc.) to hit protein target
 * - Leave carb-dominant ingredients untouched
 *
 * Guard range per ingredient: 0.5x - 2.0x.
 */
export const macroRebalancing: RepairStrategy = {
  name: 'macro-rebalancing',

  attempt(
    day: CompiledDay,
    violation: Violation,
    _clientIntake?: ClientIntake
  ): RepairResult | null {
    // Only handle macro violations with specific offending macros
    if (violation.type !== 'macro' || !violation.offendingMacros || !day.macroTargets) {
      return null;
    }

    // Filter to standard macros (not keto_cap — that's handled separately)
    const offending = violation.offendingMacros.filter(
      (m): m is 'protein' | 'carbs' | 'fat' => m === 'protein' || m === 'carbs' || m === 'fat'
    );
    if (offending.length === 0) return null;

    const { proteinG: tP, carbsG: tC, fatG: tF } = day.macroTargets;
    const { proteinG: aP, carbsG: aC, fatG: aF } = day.dailyTotals;

    // Calculate per-macro scale factors
    const macroFactors: Partial<Record<'protein' | 'carbs' | 'fat', number>> = {};
    if (offending.includes('protein') && aP > 0 && tP > 0) {
      macroFactors.protein = tP / aP;
    }
    if (offending.includes('carbs') && aC > 0 && tC > 0) {
      macroFactors.carbs = tC / aC;
    }
    if (offending.includes('fat') && aF > 0 && tF > 0) {
      macroFactors.fat = tF / aF;
    }

    if (Object.keys(macroFactors).length === 0) return null;

    // Classify all ingredients across all meals and apply targeted scaling
    const adjustedMeals: CompiledMeal[] = day.meals.map((meal) => {
      const adjustedIngredients: Ingredient[] = [];

      for (const ing of meal.ingredients) {
        const ingClass = classifyIngredient(ing.name);
        let factor = 1.0;

        // Map ingredient class to macro factor
        if (ingClass === 'protein' && macroFactors.protein !== undefined) {
          factor = macroFactors.protein;
        } else if (ingClass === 'carb' && macroFactors.carbs !== undefined) {
          factor = macroFactors.carbs;
        } else if (ingClass === 'fat' && macroFactors.fat !== undefined) {
          factor = macroFactors.fat;
        }

        // Clamp factor per ingredient
        factor = Math.max(0.5, Math.min(2.0, factor));

        adjustedIngredients.push({
          ...ing,
          amount: Math.round(ing.amount * factor * 100) / 100,
        });

        // We don't know exact per-ingredient macros here, so we need to scale
        // the meal's total macros proportionally to ingredient changes.
        // Track the total weight-adjusted factor for each macro category.
      }

      // Estimate new meal nutrition by applying factors to the meal's nutrition
      // based on the fraction contributed by each ingredient class
      const ingredientClasses = meal.ingredients.map((ing) => classifyIngredient(ing.name));
      const classCounts = { protein: 0, carb: 0, fat: 0, other: 0 };
      const classAmounts = { protein: 0, carb: 0, fat: 0, other: 0 };
      for (let i = 0; i < meal.ingredients.length; i++) {
        const cls = ingredientClasses[i];
        classCounts[cls]++;
        classAmounts[cls] += meal.ingredients[i].amount;
      }

      const totalAmount =
        classAmounts.protein + classAmounts.carb + classAmounts.fat + classAmounts.other;
      if (totalAmount === 0) {
        return { ...meal, ingredients: adjustedIngredients };
      }

      // Weighted average factor based on ingredient mass fractions
      const proteinFrac = classAmounts.protein / totalAmount;
      const carbFrac = classAmounts.carb / totalAmount;
      const fatFrac = classAmounts.fat / totalAmount;
      const otherFrac = classAmounts.other / totalAmount;

      const pFactor = Math.max(0.5, Math.min(2.0, macroFactors.protein ?? 1.0));
      const cFactor = Math.max(0.5, Math.min(2.0, macroFactors.carbs ?? 1.0));
      const fFactor = Math.max(0.5, Math.min(2.0, macroFactors.fat ?? 1.0));

      // Apply targeted scaling to each macro based on which ingredient classes were adjusted
      // Protein-dominant ingredients contribute mostly protein, etc.
      const newProtein =
        Math.round(
          meal.nutrition.proteinG *
            (proteinFrac * pFactor + carbFrac * cFactor + fatFrac * fFactor + otherFrac) *
            10
        ) / 10;

      const newCarbs =
        Math.round(
          meal.nutrition.carbsG *
            (proteinFrac * pFactor + carbFrac * cFactor + fatFrac * fFactor + otherFrac) *
            10
        ) / 10;

      const newFat =
        Math.round(
          meal.nutrition.fatG *
            (proteinFrac * pFactor + carbFrac * cFactor + fatFrac * fFactor + otherFrac) *
            10
        ) / 10;

      const newKcal = Math.round(newProtein * 4 + newCarbs * 4 + newFat * 9);

      return {
        ...meal,
        nutrition: {
          kcal: newKcal,
          proteinG: newProtein,
          carbsG: newCarbs,
          fatG: newFat,
          fiberG: meal.nutrition.fiberG,
        },
        ingredients: adjustedIngredients,
      };
    });

    const newTotals = recalcDailyTotals(adjustedMeals);
    const targetKcal = day.targetKcal;
    const newVarianceKcal = newTotals.kcal - targetKcal;
    const newVariancePercent =
      targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

    const adjustedDay: CompiledDay = {
      ...day,
      meals: adjustedMeals,
      dailyTotals: newTotals,
      varianceKcal: Math.round(newVarianceKcal),
      variancePercent: newVariancePercent,
    };

    // Verify improvement: check if offending macros are now closer to target
    const newPVar = tP > 0 ? Math.abs(newTotals.proteinG - tP) / tP : 0;
    const newCVar = tC > 0 ? Math.abs(newTotals.carbsG - tC) / tC : 0;
    const newFVar = tF > 0 ? Math.abs(newTotals.fatG - tF) / tF : 0;

    const oldPVar = tP > 0 ? Math.abs(aP - tP) / tP : 0;
    const oldCVar = tC > 0 ? Math.abs(aC - tC) / tC : 0;
    const oldFVar = tF > 0 ? Math.abs(aF - tF) / tF : 0;

    const oldWorst = Math.max(
      offending.includes('protein') ? oldPVar : 0,
      offending.includes('carbs') ? oldCVar : 0,
      offending.includes('fat') ? oldFVar : 0
    );
    const newWorst = Math.max(
      offending.includes('protein') ? newPVar : 0,
      offending.includes('carbs') ? newCVar : 0,
      offending.includes('fat') ? newFVar : 0
    );

    // Only accept if we actually improved
    if (newWorst >= oldWorst) {
      return null;
    }

    const factorDetails = Object.entries(macroFactors)
      .map(([m, f]) => `${m}: ${(((f as number) - 1) * 100).toFixed(0)}%`)
      .join(', ');

    return {
      adjustedDay,
      description: `Day ${day.dayNumber}: [macro-rebalancing] Independently scaled ${offending.join('/')} ingredients (${factorDetails})`,
    };
  },
};
