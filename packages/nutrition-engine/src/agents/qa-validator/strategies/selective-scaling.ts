import type { CompiledDay, CompiledMeal } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

/**
 * Selective scaling: find the single worst-offending meal and scale only that one.
 * Guard range: 0.5x - 2.0x.
 */
export const selectiveScaling: RepairStrategy = {
  name: 'selective-scaling',

  attempt(day: CompiledDay, violation: Violation): RepairResult | null {
    if (day.meals.length === 0 || day.dailyTotals.kcal === 0) {
      return null;
    }

    // Determine the kcal gap to close
    let kcalGap: number;

    if (violation.type === 'kcal') {
      kcalGap = day.targetKcal - day.dailyTotals.kcal;
    } else if (violation.type === 'macro' && day.macroTargets) {
      // For macro violations, approximate kcal gap from the worst macro
      const { proteinG: tP, carbsG: tC, fatG: tF } = day.macroTargets;
      const { proteinG: aP, carbsG: aC, fatG: aF } = day.dailyTotals;

      const proteinGap = (tP - aP) * 4;
      const carbsGap = (tC - aC) * 4;
      const fatGap = (tF - aF) * 9;

      // Use the gap with the largest absolute kcal impact
      const gaps = [
        { gap: proteinGap, abs: Math.abs(proteinGap) },
        { gap: carbsGap, abs: Math.abs(carbsGap) },
        { gap: fatGap, abs: Math.abs(fatGap) },
      ];
      gaps.sort((a, b) => b.abs - a.abs);
      kcalGap = gaps[0].gap;
    } else {
      return null;
    }

    if (kcalGap === 0) {
      return null;
    }

    // Find the worst-offending meal: the one whose calorie contribution
    // relative to its share of the violation is highest
    let worstIndex = 0;
    let worstScore = 0;

    for (let i = 0; i < day.meals.length; i++) {
      const meal = day.meals[i];
      // Score: how much this meal contributes to the total kcal
      // (higher kcal meals have more room to adjust)
      const mealShare = meal.nutrition.kcal / day.dailyTotals.kcal;
      // The contribution score: meals that contribute most to total get highest score
      const score = mealShare * Math.abs(meal.nutrition.kcal);
      if (score > worstScore) {
        worstScore = score;
        worstIndex = i;
      }
    }

    const targetMeal = day.meals[worstIndex];
    if (targetMeal.nutrition.kcal === 0) {
      return null;
    }

    // Calculate scale factor for this single meal
    const newMealKcal = targetMeal.nutrition.kcal + kcalGap;
    const scaleFactor = newMealKcal / targetMeal.nutrition.kcal;

    // Guard: 0.5x - 2.0x
    if (scaleFactor < 0.5 || scaleFactor > 2.0) {
      return null;
    }

    // Scale only the target meal
    const scaledMeal: CompiledMeal = {
      ...targetMeal,
      nutrition: {
        kcal: Math.round(targetMeal.nutrition.kcal * scaleFactor),
        proteinG: Math.round(targetMeal.nutrition.proteinG * scaleFactor * 10) / 10,
        carbsG: Math.round(targetMeal.nutrition.carbsG * scaleFactor * 10) / 10,
        fatG: Math.round(targetMeal.nutrition.fatG * scaleFactor * 10) / 10,
        fiberG: targetMeal.nutrition.fiberG
          ? Math.round(targetMeal.nutrition.fiberG * scaleFactor * 10) / 10
          : undefined,
      },
      ingredients: targetMeal.ingredients.map((ing) => ({
        ...ing,
        amount: Math.round(ing.amount * scaleFactor * 100) / 100,
      })),
    };

    const newMeals = [...day.meals];
    newMeals[worstIndex] = scaledMeal;

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

    const pctChange = Math.round((scaleFactor - 1) * 100);
    const description = `Day ${day.dayNumber}: [selective-scaling] Scaled meal "${targetMeal.name}" by ${pctChange > 0 ? '+' : ''}${pctChange}% to close ${Math.abs(Math.round(kcalGap))} kcal gap`;

    return { adjustedDay, description };
  },
};
