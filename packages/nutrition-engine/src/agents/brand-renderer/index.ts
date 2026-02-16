import type { MealPlanValidated } from '../../types/schemas';
import { generateSummaryHtml } from './summary-html';
import { generateGridHtml } from './grid-html';
import { generateGroceryHtml } from './grocery-list';
import { generatePdf } from './pdf-generator';

/**
 * Input size limits to prevent memory exhaustion and excessive rendering times.
 * These limits are generous for normal use but prevent abuse or edge cases.
 */
const RENDER_LIMITS = {
  MAX_DAYS: 14, // Maximum plan duration (2 weeks)
  MAX_MEALS_PER_DAY: 10, // Maximum meals per day (breakfast, lunch, dinner, + snacks)
  MAX_INGREDIENTS_PER_MEAL: 30, // Maximum ingredients in a single meal
} as const;

/**
 * Agent 6: Brand Renderer
 * Generates HTML and PDF deliverables from validated meal plan.
 * Outputs: executive summary, 7-day grid, grocery list, PDF buffer.
 */
export class BrandRenderer {
  async render(validated: MealPlanValidated): Promise<{
    summaryHtml: string;
    gridHtml: string;
    groceryHtml: string;
    pdfBuffer: Buffer;
  }> {
    // Validate input size to prevent memory exhaustion
    this.validateInputSize(validated);

    // 1. Generate executive summary HTML
    const summaryHtml = generateSummaryHtml(validated);

    // 2. Generate 7-day grid HTML
    const gridHtml = generateGridHtml(validated);

    // 3. Generate grocery list HTML
    const groceryHtml = generateGroceryHtml(validated);

    // 4. Generate PDF buffer combining all deliverables
    const pdfBuffer = await generatePdf(validated, summaryHtml, gridHtml, groceryHtml);

    return {
      summaryHtml,
      gridHtml,
      groceryHtml,
      pdfBuffer,
    };
  }

  /**
   * Validate input size to prevent memory exhaustion and excessive rendering times.
   * Throws an error if limits are exceeded.
   */
  private validateInputSize(validated: MealPlanValidated): void {
    // Check number of days
    if (validated.days.length > RENDER_LIMITS.MAX_DAYS) {
      throw new Error(
        `Plan too long: ${validated.days.length} days exceeds maximum of ${RENDER_LIMITS.MAX_DAYS} days`
      );
    }

    // Check meals per day and ingredients per meal
    for (const day of validated.days) {
      if (day.meals.length > RENDER_LIMITS.MAX_MEALS_PER_DAY) {
        throw new Error(
          `Too many meals on ${day.dayName} (Day ${day.dayNumber}): ` +
            `${day.meals.length} meals exceeds maximum of ${RENDER_LIMITS.MAX_MEALS_PER_DAY}`
        );
      }

      for (const meal of day.meals) {
        if (meal.ingredients && meal.ingredients.length > RENDER_LIMITS.MAX_INGREDIENTS_PER_MEAL) {
          throw new Error(
            `Too many ingredients in "${meal.name}" on ${day.dayName}: ` +
              `${meal.ingredients.length} ingredients exceeds maximum of ${RENDER_LIMITS.MAX_INGREDIENTS_PER_MEAL}`
          );
        }
      }
    }
  }
}
