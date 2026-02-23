import type { CompiledDay, CompiledMeal, ClientIntake } from '../../../types/schemas';
import { recalcDailyTotals, type Violation } from '../tolerance-checks';
import type { RepairStrategy, RepairResult } from './index';

/**
 * Proportional scaling: scale ALL meals by the same factor.
 * Guard range: 0.75x - 1.25x.
 */
export const proportionalScaling: RepairStrategy = {
  name: 'proportional-scaling',

  attempt(
    day: CompiledDay,
    violation: Violation,
    _clientIntake?: ClientIntake
  ): RepairResult | null {
    if (day.dailyTotals.kcal === 0) {
      return null;
    }

    let scaleFactor: number;
    let descriptionContext: string;

    if (violation.type === 'kcal') {
      const targetKcal = day.targetKcal;
      const currentKcal = day.dailyTotals.kcal;
      scaleFactor = targetKcal / currentKcal;
      descriptionContext = `kcal from ${currentKcal} toward ${targetKcal}`;
    } else if (violation.type === 'macro' && day.macroTargets) {
      const { proteinG: tP, carbsG: tC, fatG: tF } = day.macroTargets;
      const { proteinG: aP, carbsG: aC, fatG: aF } = day.dailyTotals;

      const candidates: Array<{ name: string; target: number; actual: number; variance: number }> =
        [];
      if (tP > 0)
        candidates.push({
          name: 'protein',
          target: tP,
          actual: aP,
          variance: Math.abs(aP - tP) / tP,
        });
      if (tC > 0)
        candidates.push({
          name: 'carbs',
          target: tC,
          actual: aC,
          variance: Math.abs(aC - tC) / tC,
        });
      if (tF > 0)
        candidates.push({ name: 'fat', target: tF, actual: aF, variance: Math.abs(aF - tF) / tF });

      if (candidates.length === 0) {
        return null;
      }

      candidates.sort((a, b) => b.variance - a.variance);
      const worst = candidates[0];

      if (worst.actual === 0) {
        return null;
      }

      // Before scaling for the worst macro, check if scaling would push
      // another macro beyond its tolerance (protein ±10%, carbs/fat ±15%).
      // If so, limit the scale factor to avoid collateral damage.
      const proposedFactor = worst.target / worst.actual;

      // Guard check on the raw factor — if proportional scaling can't bridge the
      // macro gap within the allowed range, bail out so other strategies can try.
      const minGuardMacro = day.targetKcal < 1500 ? 0.65 : 0.75;
      const maxGuardMacro = day.targetKcal < 1500 ? 1.35 : 1.25;
      if (proposedFactor < minGuardMacro || proposedFactor > maxGuardMacro) {
        return null;
      }

      const macroTolerances: Record<string, number> = { protein: 0.1, carbs: 0.15, fat: 0.15 };
      let safeFactor = proposedFactor;
      for (const c of candidates) {
        if (c.name === worst.name) continue;
        const tolerance = macroTolerances[c.name] || 0.15;
        const scaled = c.actual * proposedFactor;
        const scaledVariance = Math.abs(scaled - c.target) / c.target;
        if (scaledVariance > tolerance && Math.abs(c.actual - c.target) / c.target <= tolerance) {
          // Scaling would push a currently-compliant macro out of tolerance.
          // Limit the factor so it stays within tolerance.
          const maxScaled = c.target * (1 + tolerance);
          const minScaled = c.target * (1 - tolerance);
          const limitUp = c.actual > 0 ? maxScaled / c.actual : proposedFactor;
          const limitDown = c.actual > 0 ? minScaled / c.actual : proposedFactor;
          if (proposedFactor > 1) {
            safeFactor = Math.min(safeFactor, limitUp);
          } else {
            safeFactor = Math.max(safeFactor, limitDown);
          }
        }
      }

      scaleFactor = safeFactor;
      descriptionContext = `${worst.name} from ${worst.actual}g toward ${worst.target}g`;
    } else {
      return null;
    }

    // Dynamic guard: wider range for low-calorie plans where small absolute
    // errors produce large percentage deviations
    const minGuard = day.targetKcal < 1500 ? 0.65 : 0.75;
    const maxGuard = day.targetKcal < 1500 ? 1.35 : 1.25;
    if (scaleFactor < minGuard || scaleFactor > maxGuard) {
      return null;
    }

    const scaledMeals: CompiledMeal[] = day.meals.map((meal) => ({
      ...meal,
      nutrition: {
        kcal: Math.round(meal.nutrition.kcal * scaleFactor),
        proteinG: Math.round(meal.nutrition.proteinG * scaleFactor * 10) / 10,
        carbsG: Math.round(meal.nutrition.carbsG * scaleFactor * 10) / 10,
        fatG: Math.round(meal.nutrition.fatG * scaleFactor * 10) / 10,
        fiberG: meal.nutrition.fiberG
          ? Math.round(meal.nutrition.fiberG * scaleFactor * 10) / 10
          : undefined,
      },
      ingredients: meal.ingredients.map((ing) => ({
        ...ing,
        amount: Math.round(ing.amount * scaleFactor * 100) / 100,
      })),
    }));

    const targetKcal = day.targetKcal;
    const newTotals = recalcDailyTotals(scaledMeals);
    const newVarianceKcal = newTotals.kcal - targetKcal;
    const newVariancePercent =
      targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

    const adjustedDay: CompiledDay = {
      ...day,
      meals: scaledMeals,
      dailyTotals: newTotals,
      varianceKcal: Math.round(newVarianceKcal),
      variancePercent: newVariancePercent,
    };

    const pctChange = Math.round((scaleFactor - 1) * 100);
    const description = `Day ${day.dayNumber}: [proportional-scaling] Scaled all ${scaledMeals.length} meals by ${pctChange > 0 ? '+' : ''}${pctChange}% to fix ${descriptionContext}`;

    return { adjustedDay, description };
  },
};
