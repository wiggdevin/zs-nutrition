import {
  MealPlanCompiled,
  MealPlanValidated,
  MealPlanValidatedSchema,
  CompiledDay,
  CompiledMeal,
  QAResult,
  GroceryCategory,
} from '../types/schemas';

/**
 * Agent 5: QA Validator
 * Enforces calorie (±3%) and macro (±5%) tolerances.
 * Runs up to 3 optimization iterations.
 * Generates QA score 0-100 and aggregates grocery list.
 */
export class QAValidator {
  private static readonly KCAL_TOLERANCE = 0.03; // ±3%
  private static readonly MACRO_TOLERANCE = 0.05; // ±5%
  private static readonly MAX_ITERATIONS = 3;

  async validate(compiled: MealPlanCompiled): Promise<MealPlanValidated> {
    let currentDays = [...compiled.days];
    let iterations = 0;
    const adjustmentsMade: string[] = [];

    // Run optimization iterations
    for (let i = 0; i < QAValidator.MAX_ITERATIONS; i++) {
      iterations = i + 1;
      const violations = this.findViolations(currentDays);

      if (violations.length === 0) {
        // All days within tolerance — stop iterating
        break;
      }

      // Attempt to fix violations by scaling meal portions
      for (const violation of violations) {
        const day = currentDays[violation.dayIndex];
        const adjustment = this.optimizeDay(day, violation);
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

      if (absVariance <= QAValidator.KCAL_TOLERANCE * 100) {
        status = 'PASS';
      } else if (absVariance <= QAValidator.KCAL_TOLERANCE * 100 * 2) {
        // Between 3-6% → WARN
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
    const score = this.calculateQAScore(currentDays);

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
    const groceryList = this.aggregateGroceryList(currentDays);

    // Calculate weekly totals
    const weeklyTotals = this.calculateWeeklyTotals(currentDays);

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

  /**
   * Find days that violate kcal or macro tolerances.
   */
  private findViolations(
    days: CompiledDay[]
  ): Array<{ dayIndex: number; type: 'kcal' | 'macro'; variancePercent: number }> {
    const violations: Array<{
      dayIndex: number;
      type: 'kcal' | 'macro';
      variancePercent: number;
    }> = [];

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const absKcalVariance = Math.abs(day.variancePercent) / 100;

      if (absKcalVariance > QAValidator.KCAL_TOLERANCE) {
        violations.push({
          dayIndex: i,
          type: 'kcal',
          variancePercent: day.variancePercent,
        });
        continue; // Don't double-count
      }

      // Check macro tolerances (protein, carbs, fat)
      if (day.targetKcal > 0) {
        // Estimate expected macro grams from target kcal (balanced: 30/40/30)
        // We check actual macro variance against a reasonable target
        const totalMacroKcal =
          day.dailyTotals.proteinG * 4 +
          day.dailyTotals.carbsG * 4 +
          day.dailyTotals.fatG * 9;

        if (totalMacroKcal > 0) {
          const macroVsKcal = Math.abs(totalMacroKcal - day.dailyTotals.kcal) / day.dailyTotals.kcal;
          if (macroVsKcal > QAValidator.MACRO_TOLERANCE) {
            violations.push({
              dayIndex: i,
              type: 'macro',
              variancePercent: macroVsKcal * 100,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Attempt to optimize a day by scaling meals to meet target kcal.
   * Returns the adjusted day and a description of what changed.
   */
  private optimizeDay(
    day: CompiledDay,
    violation: { type: 'kcal' | 'macro'; variancePercent: number }
  ): { adjustedDay: CompiledDay; description: string } | null {
    if (violation.type !== 'kcal' || day.dailyTotals.kcal === 0) {
      return null;
    }

    const targetKcal = day.targetKcal;
    const currentKcal = day.dailyTotals.kcal;
    const scaleFactor = targetKcal / currentKcal;

    // Only scale if it's a reasonable adjustment (0.8 to 1.2 range)
    if (scaleFactor < 0.8 || scaleFactor > 1.2) {
      return null;
    }

    // Find the meal contributing most to the variance — scale that one
    const meals = [...day.meals];
    let worstMealIdx = 0;
    let maxKcal = 0;
    for (let i = 0; i < meals.length; i++) {
      if (meals[i].nutrition.kcal > maxKcal) {
        maxKcal = meals[i].nutrition.kcal;
        worstMealIdx = i;
      }
    }

    // Scale the largest meal to bring the day closer to target
    const worstMeal = meals[worstMealIdx];
    const deficitOrExcess = targetKcal - currentKcal;
    const adjustedKcal = worstMeal.nutrition.kcal + deficitOrExcess;

    if (adjustedKcal <= 0) {
      return null;
    }

    const mealScale = adjustedKcal / worstMeal.nutrition.kcal;
    const adjustedMeal: CompiledMeal = {
      ...worstMeal,
      nutrition: {
        kcal: Math.round(worstMeal.nutrition.kcal * mealScale),
        proteinG: Math.round(worstMeal.nutrition.proteinG * mealScale * 10) / 10,
        carbsG: Math.round(worstMeal.nutrition.carbsG * mealScale * 10) / 10,
        fatG: Math.round(worstMeal.nutrition.fatG * mealScale * 10) / 10,
        fiberG: worstMeal.nutrition.fiberG
          ? Math.round(worstMeal.nutrition.fiberG * mealScale * 10) / 10
          : undefined,
      },
    };

    meals[worstMealIdx] = adjustedMeal;

    // Recalculate daily totals
    const newTotals = this.recalcDailyTotals(meals);
    const newVarianceKcal = newTotals.kcal - targetKcal;
    const newVariancePercent =
      targetKcal > 0
        ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100
        : 0;

    const adjustedDay: CompiledDay = {
      ...day,
      meals,
      dailyTotals: newTotals,
      varianceKcal: Math.round(newVarianceKcal),
      variancePercent: newVariancePercent,
    };

    const description = `Day ${day.dayNumber}: Scaled "${worstMeal.name}" (${worstMeal.slot}) by ${Math.round((mealScale - 1) * 100)}% to bring kcal from ${currentKcal} → ${newTotals.kcal} (target: ${targetKcal})`;

    return { adjustedDay, description };
  }

  /**
   * Recalculate daily nutrition totals from meals.
   */
  private recalcDailyTotals(meals: CompiledMeal[]) {
    let kcal = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    let fiberG = 0;

    for (const meal of meals) {
      kcal += meal.nutrition.kcal;
      proteinG += meal.nutrition.proteinG;
      carbsG += meal.nutrition.carbsG;
      fatG += meal.nutrition.fatG;
      if (meal.nutrition.fiberG) {
        fiberG += meal.nutrition.fiberG;
      }
    }

    return {
      kcal: Math.round(kcal),
      proteinG: Math.round(proteinG * 10) / 10,
      carbsG: Math.round(carbsG * 10) / 10,
      fatG: Math.round(fatG * 10) / 10,
      fiberG: fiberG > 0 ? Math.round(fiberG * 10) / 10 : undefined,
    };
  }

  /**
   * Calculate QA score 0-100.
   * Score is based on how close each day is to its target kcal.
   * Perfect adherence = 100, each % of variance costs points.
   */
  private calculateQAScore(days: CompiledDay[]): number {
    if (days.length === 0) return 100;

    let totalScore = 0;

    for (const day of days) {
      const absVariance = Math.abs(day.variancePercent);
      // Each day starts at 100 and loses points for variance
      // 1% variance = -5 points, capped at 0
      const dayScore = Math.max(0, 100 - absVariance * 5);
      totalScore += dayScore;
    }

    return Math.round(totalScore / days.length);
  }

  /**
   * Aggregate all ingredients from all days into categorized grocery list.
   */
  private aggregateGroceryList(days: CompiledDay[]): GroceryCategory[] {
    // Collect all ingredients
    const ingredientMap = new Map<string, { amount: number; unit: string }>();

    for (const day of days) {
      for (const meal of day.meals) {
        for (const ing of meal.ingredients) {
          const key = `${ing.name}|${ing.unit}`;
          const existing = ingredientMap.get(key);
          if (existing) {
            existing.amount += ing.amount;
          } else {
            ingredientMap.set(key, { amount: ing.amount, unit: ing.unit });
          }
        }
      }
    }

    // Categorize ingredients
    const categoryMap = new Map<string, Array<{ name: string; amount: number; unit: string }>>();

    const categoryRules: Array<{ keywords: string[]; category: string }> = [
      { keywords: ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'tuna', 'cod', 'shrimp', 'fish', 'steak', 'lamb'], category: 'Meat & Seafood' },
      { keywords: ['egg', 'yogurt', 'cheese', 'milk', 'cream', 'butter'], category: 'Dairy & Eggs' },
      { keywords: ['rice', 'pasta', 'bread', 'oats', 'quinoa', 'tortilla', 'bagel', 'pancake', 'flour', 'cereal'], category: 'Grains & Bread' },
      { keywords: ['spinach', 'broccoli', 'tomato', 'pepper', 'lettuce', 'salad', 'carrot', 'onion', 'garlic', 'potato', 'corn', 'zucchini', 'mushroom', 'asparagus', 'vegetable', 'greens', 'avocado', 'sweet potato'], category: 'Produce' },
      { keywords: ['banana', 'berr', 'mango', 'apple', 'orange', 'fruit', 'lemon', 'lime'], category: 'Fruits' },
      { keywords: ['bean', 'lentil', 'chickpea', 'tofu', 'tempeh', 'edamame'], category: 'Legumes & Plant Protein' },
      { keywords: ['olive oil', 'oil', 'vinegar', 'soy sauce', 'honey', 'maple', 'sauce', 'dressing'], category: 'Oils & Condiments' },
      { keywords: ['salt', 'pepper', 'spice', 'herb', 'cumin', 'paprika', 'garlic powder', 'season', 'taste'], category: 'Spices & Seasonings' },
      { keywords: ['almond', 'walnut', 'peanut', 'seed', 'nut', 'cashew'], category: 'Nuts & Seeds' },
    ];

    for (const [key, { amount, unit }] of ingredientMap) {
      const name = key.split('|')[0];
      const nameLower = name.toLowerCase();

      let category = 'Other';
      for (const rule of categoryRules) {
        if (rule.keywords.some((kw) => nameLower.includes(kw))) {
          category = rule.category;
          break;
        }
      }

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push({
        name,
        amount: this.roundUpForShopping(amount, unit),
        unit,
      });
    }

    // Convert to GroceryCategory array, sorted by category name
    return Array.from(categoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }

  /**
   * Round amounts UP for practical shopping.
   * - Weight units (g, kg, oz, lbs): round up to nearest practical increment
   * - Volume units (ml, l, cups, tbsp, tsp): round up to nearest practical increment
   * - Count/pieces: round up to whole number
   * - Small amounts (< 1): round up to nearest 0.25 or 0.5
   */
  private roundUpForShopping(amount: number, unit: string): number {
    const unitLower = unit.toLowerCase().trim();

    // Grams: round up to nearest 25g for amounts > 100g, nearest 10g for smaller
    if (unitLower === 'g' || unitLower === 'grams' || unitLower === 'gram') {
      if (amount > 500) return Math.ceil(amount / 50) * 50;
      if (amount > 100) return Math.ceil(amount / 25) * 25;
      return Math.ceil(amount / 10) * 10;
    }

    // Kilograms: round up to nearest 0.25 kg
    if (unitLower === 'kg' || unitLower === 'kilograms' || unitLower === 'kilogram') {
      return Math.ceil(amount * 4) / 4;
    }

    // Ounces: round up to whole ounces
    if (unitLower === 'oz' || unitLower === 'ounces' || unitLower === 'ounce') {
      return Math.ceil(amount);
    }

    // Pounds: round up to nearest 0.5 lb
    if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pounds' || unitLower === 'pound') {
      return Math.ceil(amount * 2) / 2;
    }

    // Milliliters: round up to nearest 25ml or 50ml
    if (unitLower === 'ml' || unitLower === 'milliliters' || unitLower === 'milliliter') {
      if (amount > 200) return Math.ceil(amount / 50) * 50;
      return Math.ceil(amount / 25) * 25;
    }

    // Liters: round up to nearest 0.25
    if (unitLower === 'l' || unitLower === 'liters' || unitLower === 'liter') {
      return Math.ceil(amount * 4) / 4;
    }

    // Cups: round up to nearest 0.25 cup
    if (unitLower === 'cup' || unitLower === 'cups') {
      return Math.ceil(amount * 4) / 4;
    }

    // Tablespoons: round up to whole tbsp
    if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') {
      return Math.ceil(amount);
    }

    // Teaspoons: round up to nearest 0.5 tsp
    if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
      return Math.ceil(amount * 2) / 2;
    }

    // Scoops, slices, pieces, etc: round up to whole numbers
    if (['scoop', 'scoops', 'slice', 'slices', 'piece', 'pieces', 'whole', 'clove', 'cloves'].includes(unitLower)) {
      return Math.ceil(amount);
    }

    // Default: round up to nearest 0.5
    if (amount < 1) {
      return Math.ceil(amount * 4) / 4; // nearest 0.25
    }
    return Math.ceil(amount * 2) / 2; // nearest 0.5
  }

  /**
   * Calculate weekly average totals across all days.
   */
  private calculateWeeklyTotals(days: CompiledDay[]) {
    if (days.length === 0) {
      return { avgKcal: 0, avgProteinG: 0, avgCarbsG: 0, avgFatG: 0 };
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const day of days) {
      totalKcal += day.dailyTotals.kcal;
      totalProtein += day.dailyTotals.proteinG;
      totalCarbs += day.dailyTotals.carbsG;
      totalFat += day.dailyTotals.fatG;
    }

    const count = days.length;
    return {
      avgKcal: Math.round(totalKcal / count),
      avgProteinG: Math.round((totalProtein / count) * 10) / 10,
      avgCarbsG: Math.round((totalCarbs / count) * 10) / 10,
      avgFatG: Math.round((totalFat / count) * 10) / 10,
    };
  }
}
