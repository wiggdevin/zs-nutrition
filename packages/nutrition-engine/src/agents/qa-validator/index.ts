import {
  MealPlanCompiled,
  MealPlanValidated,
  MealPlanValidatedSchema,
  QAResult,
} from '../../types/schemas';
import {
  KCAL_TOLERANCE,
  PROTEIN_TOLERANCE,
  CARBS_TOLERANCE,
  FAT_TOLERANCE,
  findViolations,
  computeMacroVariances,
  calculateQAScore,
  calculateWeeklyTotals,
} from './tolerance-checks';
import { optimizeDay, aggregateGroceryList } from './repair-strategies';

/**
 * Agent 5: QA Validator
 * Enforces calorie (+/-3%) and per-macro tolerances (P:10%, C:15%, F:15%).
 * Runs a single optimization pass then determines final status.
 * Generates QA score 0-100 and aggregates grocery list.
 */
export class QAValidator {
  async validate(compiled: MealPlanCompiled): Promise<MealPlanValidated> {
    const currentDays = [...compiled.days];
    const adjustmentsMade: string[] = [];

    // Single optimization pass (P2-T07: replaced 3-iteration loop)
    const violations = findViolations(currentDays);

    if (violations.length > 0) {
      // Attempt to fix violations by scaling meal portions
      for (const violation of violations) {
        const day = currentDays[violation.dayIndex];
        const adjustment = optimizeDay(day, violation);
        if (adjustment) {
          currentDays[violation.dayIndex] = adjustment.adjustedDay;
          adjustmentsMade.push(adjustment.description);
        }
      }
    }

    // Recalculate violations after the single optimization pass to determine final status
    const finalViolations = findViolations(currentDays);
    const _violatedDayIndices = new Set(finalViolations.map((v) => v.dayIndex));

    // Calculate final day QA results with macro variances
    const dayResults = currentDays.map((day, _idx) => {
      const absVariance = Math.abs(day.variancePercent);
      const macroVars = computeMacroVariances(day);

      // Determine kcal status
      let kcalStatus: 'PASS' | 'WARN' | 'FAIL';
      if (absVariance <= KCAL_TOLERANCE * 100) {
        kcalStatus = 'PASS';
      } else if (absVariance <= KCAL_TOLERANCE * 100 * 2) {
        // Between 3-6% -> WARN
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

        const proteinFail = pAbs > PROTEIN_TOLERANCE;
        const carbsFail = cAbs > CARBS_TOLERANCE;
        const fatFail = fAbs > FAT_TOLERANCE;

        if (proteinFail || carbsFail || fatFail) {
          // Check if any macro is more than 2x its tolerance (FAIL vs WARN)
          const proteinHardFail = pAbs > PROTEIN_TOLERANCE * 2;
          const carbsHardFail = cAbs > CARBS_TOLERANCE * 2;
          const fatHardFail = fAbs > FAT_TOLERANCE * 2;

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

    // Calculate overall QA score (0-100)
    const score = calculateQAScore(currentDays);

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
