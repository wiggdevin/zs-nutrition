import {
  MealPlanCompiled,
  MealPlanValidated,
  MealPlanValidatedSchema,
  QAResult,
  ClientIntake,
} from '../../types/schemas';
import { containsAllergenTerm, isDietaryCompliant } from '../../utils/dietary-compliance';
import {
  KCAL_TOLERANCE,
  KCAL_ABS_FLOOR,
  PROTEIN_TOLERANCE,
  CARBS_TOLERANCE,
  FAT_TOLERANCE,
  findViolations,
  computeMacroVariances,
  calculateQAScore,
  calculateWeeklyTotals,
  confidenceToleranceMultiplier,
  recalcDailyTotals,
} from './tolerance-checks';
import { aggregateGroceryList } from './repair-strategies';
import type { RepairStrategy } from './strategies/index';
import { proportionalScaling } from './strategies/proportional-scaling';
import { selectiveScaling } from './strategies/selective-scaling';
import { snackAdjustment } from './strategies/snack-adjustment';
import { ingredientSubstitution } from './strategies/ingredient-substitution';
import { proteinBoost } from './strategies/protein-boost';
import { macroRebalancing } from './strategies/macro-rebalancing';
import { repairComplianceViolations } from './strategies/compliance-substitution';

/** Ordered cascade of repair strategies. For each violation, strategies are
 *  tried in order until one succeeds. */
const REPAIR_CASCADE: RepairStrategy[] = [
  macroRebalancing,
  proportionalScaling,
  selectiveScaling,
  snackAdjustment,
  proteinBoost,
  ingredientSubstitution,
];

/**
 * Agent 5: QA Validator
 * Enforces calorie (+/-3%) and per-macro tolerances (P:10%, C:15%, F:15%).
 * Runs a cascade of repair strategies then determines final status.
 * Generates QA score 0-100 and aggregates grocery list.
 */
export class QAValidator {
  async validate(
    compiled: MealPlanCompiled,
    clientIntake?: ClientIntake
  ): Promise<MealPlanValidated> {
    const currentDays = [...compiled.days];
    const adjustmentsMade: string[] = [];

    // 2-pass repair: first pass may partially fix, second pass finishes
    for (let pass = 0; pass < 2; pass++) {
      const violations = findViolations(currentDays, clientIntake?.macroStyle);
      if (violations.length === 0) break;

      for (const violation of violations) {
        let repaired = false;
        for (const strategy of REPAIR_CASCADE) {
          const day = currentDays[violation.dayIndex];
          const result = strategy.attempt(day, violation, clientIntake);
          if (result) {
            currentDays[violation.dayIndex] = result.adjustedDay;
            adjustmentsMade.push(result.description);
            repaired = true;
            break;
          }
        }
        if (!repaired && pass === 1) {
          adjustmentsMade.push(
            `Day ${currentDays[violation.dayIndex].dayNumber}: No strategy could fix ${violation.type} violation (${violation.variancePercent}%)`
          );
        }
      }
    }

    // Layer 3B: Keto carb gate — hard-enforce daily carb cap after repair cascade
    if (clientIntake?.macroStyle === 'keto') {
      for (let i = 0; i < currentDays.length; i++) {
        const day = currentDays[i];
        const carbTarget = day.macroTargets?.carbsG ?? 0;
        // Cap = target × 1.1 with a floor of 25g
        const carbCap = Math.max(25, carbTarget * 1.1);
        const actualCarbs = day.dailyTotals.carbsG;

        if (actualCarbs > carbCap) {
          // Hard-scale carb-dense ingredients down to bring carbs within cap
          const carbReductionFactor = carbCap / actualCarbs;
          const CARB_KEYWORDS = [
            'rice',
            'quinoa',
            'oats',
            'pasta',
            'bread',
            'tortilla',
            'potato',
            'sweet potato',
            'lentil',
            'chickpea',
            'bean',
            'banana',
            'apple',
            'corn',
            'cereal',
            'granola',
            'honey',
            'maple',
            'sugar',
          ];

          const scaledMeals = day.meals.map((meal) => ({
            ...meal,
            nutrition: {
              ...meal.nutrition,
              carbsG: Math.round(meal.nutrition.carbsG * carbReductionFactor * 10) / 10,
              kcal: Math.round(
                meal.nutrition.proteinG * 4 +
                  meal.nutrition.carbsG * carbReductionFactor * 4 +
                  meal.nutrition.fatG * 9
              ),
            },
            ingredients: meal.ingredients.map((ing) => {
              const isCarb = CARB_KEYWORDS.some((kw) => ing.name.toLowerCase().includes(kw));
              if (!isCarb) return ing;
              return {
                ...ing,
                amount: Math.round(ing.amount * carbReductionFactor * 100) / 100,
              };
            }),
          }));

          const newTotals = recalcDailyTotals(scaledMeals);
          const newVarianceKcal = newTotals.kcal - day.targetKcal;
          const newVariancePercent =
            day.targetKcal > 0 ? Math.round((newVarianceKcal / day.targetKcal) * 10000) / 100 : 0;

          currentDays[i] = {
            ...day,
            meals: scaledMeals,
            dailyTotals: newTotals,
            varianceKcal: Math.round(newVarianceKcal),
            variancePercent: newVariancePercent,
          };
          adjustmentsMade.push(
            `Day ${day.dayNumber}: [keto-carb-gate] Scaled carbs from ${actualCarbs.toFixed(1)}g to ${newTotals.carbsG.toFixed(1)}g (cap: ${carbCap.toFixed(0)}g)`
          );
        }
      }
    }

    // Active compliance repair (Layer A4): substitute violating ingredients
    if (clientIntake) {
      for (let i = 0; i < currentDays.length; i++) {
        const result = repairComplianceViolations(currentDays[i], clientIntake);
        if (result) {
          currentDays[i] = result.adjustedDay;
          adjustmentsMade.push(result.description);
        }
      }
    }

    // Dietary compliance scan (warnings only — compiler should have filtered, but belt-and-suspenders)
    const complianceWarnings: string[] = [];
    if (clientIntake) {
      for (const day of currentDays) {
        for (const meal of day.meals) {
          for (const ingredient of meal.ingredients) {
            // Check ingredient name against allergens
            for (const allergen of clientIntake.allergies) {
              if (containsAllergenTerm(ingredient.name, allergen)) {
                complianceWarnings.push(
                  `Day ${day.dayNumber} "${meal.name}": ingredient "${ingredient.name}" may contain allergen "${allergen}"`
                );
              }
            }
            // Check dietary style
            if (!isDietaryCompliant(ingredient.name, clientIntake.dietaryStyle)) {
              complianceWarnings.push(
                `Day ${day.dayNumber} "${meal.name}": ingredient "${ingredient.name}" may violate ${clientIntake.dietaryStyle} diet`
              );
            }
          }
        }
      }
    }

    // Calculate final day QA results with macro variances
    const dayResults = currentDays.map((day, _idx) => {
      const absVariance = Math.abs(day.variancePercent);
      const macroVars = computeMacroVariances(day);

      // Confidence-aware tolerance multiplier (looser for low-confidence days)
      const confMultiplier = confidenceToleranceMultiplier(day);

      // Effective kcal tolerance: max of percentage-based and absolute-floor-based
      const effectiveKcalTol =
        day.targetKcal > 0
          ? Math.max(KCAL_TOLERANCE * confMultiplier, KCAL_ABS_FLOOR / day.targetKcal)
          : KCAL_TOLERANCE * confMultiplier;

      // Determine kcal status
      let kcalStatus: 'PASS' | 'WARN' | 'FAIL';
      if (absVariance <= effectiveKcalTol * 100) {
        kcalStatus = 'PASS';
      } else if (absVariance <= effectiveKcalTol * 100 * 2) {
        kcalStatus = 'WARN';
      } else {
        kcalStatus = 'FAIL';
      }

      // Determine macro status (if macroTargets present)
      let macroStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
      if (macroVars) {
        const pAbs = Math.abs(macroVars.proteinPercent) / 100;
        const cAbs = Math.abs(macroVars.carbsPercent) / 100;
        const fAbs = Math.abs(macroVars.fatPercent) / 100;

        const proteinFail = pAbs > PROTEIN_TOLERANCE * confMultiplier;
        const carbsFail = cAbs > CARBS_TOLERANCE * confMultiplier;
        const fatFail = fAbs > FAT_TOLERANCE * confMultiplier;

        if (proteinFail || carbsFail || fatFail) {
          // Check if any macro is more than 2x its tolerance (FAIL vs WARN)
          const proteinHardFail = pAbs > PROTEIN_TOLERANCE * confMultiplier * 2;
          const carbsHardFail = cAbs > CARBS_TOLERANCE * confMultiplier * 2;
          const fatHardFail = fAbs > FAT_TOLERANCE * confMultiplier * 2;

          macroStatus = proteinHardFail || carbsHardFail || fatHardFail ? 'FAIL' : 'WARN';
        }
      }

      // Combined status: worst of kcal and macro
      const statusRank = { PASS: 0, WARN: 1, FAIL: 2 } as const;
      const status: 'PASS' | 'WARN' | 'FAIL' =
        statusRank[kcalStatus] >= statusRank[macroStatus] ? kcalStatus : macroStatus;

      return {
        dayNumber: day.dayNumber,
        variancePercent: day.variancePercent,
        status,
        macroVariances: macroVars ?? undefined,
      };
    });

    // Count remaining compliance violations after repair
    const remainingViolationCount = complianceWarnings.length;

    // Calculate overall QA score (0-100)
    const score = calculateQAScore(currentDays, remainingViolationCount);

    // Determine overall status
    const hasAnyFail = dayResults.some((d) => d.status === 'FAIL');
    const hasAnyWarn = dayResults.some((d) => d.status === 'WARN');
    let overallStatus: 'PASS' | 'WARN' | 'FAIL';

    if (hasAnyFail) {
      overallStatus = 'FAIL';
    } else if (hasAnyWarn) {
      overallStatus = 'WARN';
    } else {
      overallStatus = 'PASS';
    }

    // Override status based on remaining compliance violations
    if (remainingViolationCount >= 3) {
      overallStatus = 'FAIL';
    } else if (remainingViolationCount >= 1 && overallStatus === 'PASS') {
      overallStatus = 'WARN';
    }

    // Append compliance warnings to adjustmentsMade for visibility
    if (complianceWarnings.length > 0) {
      adjustmentsMade.push(...complianceWarnings.map((w) => `[COMPLIANCE] ${w}`));
    }

    const qa: QAResult = {
      status: overallStatus,
      score,
      dayResults,
      iterations: 1,
      adjustmentsMade,
    };

    // Aggregate grocery list
    const groceryList = aggregateGroceryList(currentDays);

    // Calculate weekly totals
    const weeklyTotals = calculateWeeklyTotals(currentDays);

    const result: MealPlanValidated = {
      days: currentDays,
      groceryList,
      qa,
      weeklyTotals,
      generatedAt: new Date().toISOString(),
      engineVersion: '2.0.0',
    };

    return MealPlanValidatedSchema.parse(result);
  }
}
