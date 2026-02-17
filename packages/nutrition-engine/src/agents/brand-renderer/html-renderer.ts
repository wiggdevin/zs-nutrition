import type { MealPlanValidated } from '../../types/schemas';
import { generateSummaryHtml } from './summary-html';
import { generateGridHtml } from './grid-html';
import { generateGroceryHtml } from './grocery-list';

/**
 * Input size limits to prevent memory exhaustion and excessive rendering times.
 */
const RENDER_LIMITS = {
  MAX_DAYS: 14,
  MAX_MEALS_PER_DAY: 10,
  MAX_INGREDIENTS_PER_MEAL: 30,
} as const;

export interface HtmlRenderResult {
  summaryHtml: string;
  gridHtml: string;
  groceryHtml: string;
}

/**
 * HtmlRenderer (P4-T01)
 * Pure CPU function that generates 3 HTML strings from a validated meal plan.
 * Split from BrandRenderer for independent use and parallel rendering.
 */
export function renderHtml(validated: MealPlanValidated): HtmlRenderResult {
  validateInputSize(validated);

  const summaryHtml = generateSummaryHtml(validated);
  const gridHtml = generateGridHtml(validated);
  const groceryHtml = generateGroceryHtml(validated);

  return { summaryHtml, gridHtml, groceryHtml };
}

/**
 * Validate input size to prevent memory exhaustion and excessive rendering times.
 */
function validateInputSize(validated: MealPlanValidated): void {
  if (validated.days.length > RENDER_LIMITS.MAX_DAYS) {
    throw new Error(
      `Plan too long: ${validated.days.length} days exceeds maximum of ${RENDER_LIMITS.MAX_DAYS} days`
    );
  }

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
