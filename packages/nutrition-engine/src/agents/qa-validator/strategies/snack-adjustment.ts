import type { CompiledDay, CompiledMeal } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

interface SnackTemplate {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const SNACK_LIBRARY: SnackTemplate[] = [
  { name: 'String Cheese', kcal: 80, proteinG: 7, carbsG: 1, fatG: 5 },
  { name: 'Banana', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
  { name: 'Cottage Cheese (1/2 cup)', kcal: 110, proteinG: 14, carbsG: 5, fatG: 2.5 },
  { name: 'Edamame (1/2 cup)', kcal: 120, proteinG: 11, carbsG: 9, fatG: 5 },
  { name: 'Hard Boiled Eggs x2', kcal: 140, proteinG: 12, carbsG: 1, fatG: 10 },
  { name: 'Greek Yogurt (plain)', kcal: 150, proteinG: 15, carbsG: 9, fatG: 5 },
  { name: 'Rice Cakes + Almond Butter', kcal: 170, proteinG: 5, carbsG: 20, fatG: 8 },
  { name: 'Mixed Nuts (1 oz)', kcal: 180, proteinG: 5, carbsG: 7, fatG: 15 },
  { name: 'Protein Bar', kcal: 200, proteinG: 20, carbsG: 22, fatG: 7 },
  { name: 'Apple + Peanut Butter', kcal: 250, proteinG: 7, carbsG: 30, fatG: 14 },
];

/**
 * Snack adjustment: add a filler snack if under target, or reduce/remove
 * a snack if over target. Only operates on snack-slot meals.
 */
export const snackAdjustment: RepairStrategy = {
  name: 'snack-adjustment',

  attempt(day: CompiledDay, violation: Violation): RepairResult | null {
    const kcalGap = day.targetKcal - day.dailyTotals.kcal;

    // Only trigger for gaps > 100 kcal (either direction)
    if (Math.abs(kcalGap) <= 100) {
      return null;
    }

    // Only handle kcal violations for snack adjustment
    if (violation.type !== 'kcal') {
      return null;
    }

    if (kcalGap > 0) {
      // Under target: add a snack
      return addSnack(day, kcalGap);
    } else {
      // Over target: reduce or remove a snack
      return reduceSnack(day, kcalGap);
    }
  },
};

function addSnack(day: CompiledDay, kcalGap: number): RepairResult | null {
  // Find the best-fitting snack (closest to the gap without exceeding 1.5x the gap)
  const maxKcal = kcalGap * 1.5;
  const candidates = SNACK_LIBRARY.filter((s) => s.kcal <= maxKcal).sort(
    (a, b) => Math.abs(a.kcal - kcalGap) - Math.abs(b.kcal - kcalGap)
  );

  if (candidates.length === 0) {
    return null;
  }

  const snack = candidates[0];

  // Determine snack slot number
  const existingSnacks = day.meals.filter((m) => m.slot.toLowerCase().includes('snack'));
  const slotNumber = existingSnacks.length + 1;

  const newMeal: CompiledMeal = {
    slot: `snack_${slotNumber}`,
    name: snack.name,
    cuisine: 'Any',
    prepTimeMin: 2,
    cookTimeMin: 0,
    servings: 1,
    nutrition: {
      kcal: snack.kcal,
      proteinG: snack.proteinG,
      carbsG: snack.carbsG,
      fatG: snack.fatG,
    },
    confidenceLevel: 'ai_estimated',
    ingredients: [
      {
        name: snack.name,
        amount: 1,
        unit: 'serving',
      },
    ],
    instructions: [`Prepare ${snack.name}.`],
    primaryProtein: snack.proteinG >= 10 ? snack.name.split(' ')[0] : 'none',
    tags: ['snack', 'quick'],
  };

  const newMeals = [...day.meals, newMeal];
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
    description: `Day ${day.dayNumber}: [snack-adjustment] Added "${snack.name}" (+${snack.kcal} kcal) to close ${Math.round(kcalGap)} kcal deficit`,
  };
}

function reduceSnack(day: CompiledDay, kcalGap: number): RepairResult | null {
  // kcalGap is negative here (over target)
  const excess = Math.abs(kcalGap);

  // Find snack meals
  const snackIndices: number[] = [];
  for (let i = 0; i < day.meals.length; i++) {
    if (day.meals[i].slot.toLowerCase().includes('snack')) {
      snackIndices.push(i);
    }
  }

  if (snackIndices.length === 0) {
    return null;
  }

  // Sort snacks by kcal descending to remove the biggest first
  snackIndices.sort((a, b) => day.meals[b].nutrition.kcal - day.meals[a].nutrition.kcal);

  const newMeals = [...day.meals];
  let removedKcal = 0;
  const removedNames: string[] = [];

  for (const idx of snackIndices) {
    const snack = newMeals[idx];
    if (snack.nutrition.kcal <= excess - removedKcal) {
      // Remove the entire snack
      removedKcal += snack.nutrition.kcal;
      removedNames.push(snack.name);
      newMeals.splice(idx, 1);
      // Adjust remaining indices since we spliced
      break; // Remove one snack at a time to avoid over-correction
    } else {
      // Scale down the snack
      const targetSnackKcal = snack.nutrition.kcal - (excess - removedKcal);
      const scaleFactor = targetSnackKcal / snack.nutrition.kcal;

      if (scaleFactor < 0.2) {
        // If scaling would be extreme, just remove it
        removedKcal += snack.nutrition.kcal;
        removedNames.push(snack.name);
        newMeals.splice(idx, 1);
        break;
      }

      newMeals[idx] = {
        ...snack,
        nutrition: {
          kcal: Math.round(snack.nutrition.kcal * scaleFactor),
          proteinG: Math.round(snack.nutrition.proteinG * scaleFactor * 10) / 10,
          carbsG: Math.round(snack.nutrition.carbsG * scaleFactor * 10) / 10,
          fatG: Math.round(snack.nutrition.fatG * scaleFactor * 10) / 10,
          fiberG: snack.nutrition.fiberG
            ? Math.round(snack.nutrition.fiberG * scaleFactor * 10) / 10
            : undefined,
        },
        ingredients: snack.ingredients.map((ing) => ({
          ...ing,
          amount: Math.round(ing.amount * scaleFactor * 100) / 100,
        })),
      };
      removedKcal = excess; // We've accounted for the full excess
      removedNames.push(`${snack.name} (reduced)`);
      break;
    }
  }

  if (removedKcal === 0) {
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
    description: `Day ${day.dayNumber}: [snack-adjustment] Removed/reduced ${removedNames.join(', ')} (-${Math.round(removedKcal)} kcal) to fix ${Math.round(excess)} kcal surplus`,
  };
}
