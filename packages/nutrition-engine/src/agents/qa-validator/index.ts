import {
  MealPlanCompiled,
  MealPlanValidated,
  MealPlanValidatedSchema,
  QAResult,
} from '../../types/schemas';
import {
  KCAL_TOLERANCE,
  MAX_ITERATIONS,
  findViolations,
  calculateQAScore,
  calculateWeeklyTotals,
} from './tolerance-checks';
import { optimizeDay, aggregateGroceryList } from './repair-strategies';

/**
 * Agent 5: QA Validator
 * Enforces calorie (+/-3%) and macro (+/-5%) tolerances.
 * Runs up to 3 optimization iterations.
 * Generates QA score 0-100 and aggregates grocery list.
 */
export class QAValidator {
  async validate(compiled: MealPlanCompiled): Promise<MealPlanValidated> {
    const currentDays = [...compiled.days];
    let iterations = 0;
    const adjustmentsMade: string[] = [];

    // Run optimization iterations
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations = i + 1;
      const violations = findViolations(currentDays);

      if (violations.length === 0) {
        // All days within tolerance -- stop iterating
        break;
      }

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

    // Calculate final day QA results
    const dayResults = currentDays.map((day) => {
      const absVariance = Math.abs(day.variancePercent);
      let status: 'PASS' | 'WARN' | 'FAIL';

      if (absVariance <= KCAL_TOLERANCE * 100) {
        status = 'PASS';
      } else if (absVariance <= KCAL_TOLERANCE * 100 * 2) {
        // Between 3-6% -> WARN
        status = 'WARN';
      } else {
        status = 'FAIL';
      }

      return {
        dayNumber: day.dayNumber,
        variancePercent: day.variancePercent,
        status,
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
      iterations,
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
