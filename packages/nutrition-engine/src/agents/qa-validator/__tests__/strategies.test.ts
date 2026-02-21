import { describe, it, expect } from 'vitest';
import type { CompiledDay, CompiledMeal } from '../../../types/schemas';
import type { Violation } from '../tolerance-checks';
import { proportionalScaling } from '../strategies/proportional-scaling';
import { selectiveScaling } from '../strategies/selective-scaling';
import { snackAdjustment } from '../strategies/snack-adjustment';
import { ingredientSubstitution } from '../strategies/ingredient-substitution';
import type { RepairStrategy } from '../strategies/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeal(overrides: Partial<CompiledMeal> = {}): CompiledMeal {
  return {
    slot: 'lunch',
    name: 'Grilled Chicken Bowl',
    cuisine: 'American',
    prepTimeMin: 10,
    cookTimeMin: 15,
    servings: 1,
    nutrition: { kcal: 500, proteinG: 40, carbsG: 50, fatG: 15 },
    confidenceLevel: 'ai_estimated',
    ingredients: [
      { name: 'Chicken Breast', amount: 200, unit: 'g' },
      { name: 'White Rice', amount: 150, unit: 'g' },
      { name: 'Broccoli', amount: 100, unit: 'g' },
    ],
    instructions: ['Cook chicken.', 'Serve with rice and broccoli.'],
    primaryProtein: 'Chicken',
    tags: ['high-protein'],
    ...overrides,
  };
}

function makeSnackMeal(overrides: Partial<CompiledMeal> = {}): CompiledMeal {
  return makeMeal({
    slot: 'snack_1',
    name: 'Protein Bar',
    nutrition: { kcal: 200, proteinG: 20, carbsG: 22, fatG: 7 },
    ingredients: [{ name: 'Protein Bar', amount: 1, unit: 'piece' }],
    ...overrides,
  });
}

function makeDay(overrides: Partial<CompiledDay> = {}): CompiledDay {
  const meals = overrides.meals ?? [
    makeMeal({
      slot: 'breakfast',
      name: 'Oatmeal',
      nutrition: { kcal: 400, proteinG: 15, carbsG: 60, fatG: 10 },
    }),
    makeMeal({ slot: 'lunch' }),
    makeMeal({
      slot: 'dinner',
      name: 'Salmon Plate',
      nutrition: { kcal: 600, proteinG: 45, carbsG: 40, fatG: 25 },
    }),
  ];

  const totalKcal = meals.reduce((s, m) => s + m.nutrition.kcal, 0);
  const totalProtein = meals.reduce((s, m) => s + m.nutrition.proteinG, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.nutrition.carbsG, 0);
  const totalFat = meals.reduce((s, m) => s + m.nutrition.fatG, 0);

  const targetKcal = overrides.targetKcal ?? 1500;
  const varianceKcal = totalKcal - targetKcal;
  const variancePercent =
    targetKcal > 0 ? Math.round((varianceKcal / targetKcal) * 10000) / 100 : 0;

  return {
    dayNumber: 1,
    dayName: 'Monday',
    isTrainingDay: false,
    targetKcal,
    meals,
    dailyTotals: {
      kcal: totalKcal,
      proteinG: totalProtein,
      carbsG: totalCarbs,
      fatG: totalFat,
    },
    varianceKcal,
    variancePercent,
    ...overrides,
    // Ensure computed fields reflect overrides
  };
}

// ---------------------------------------------------------------------------
// Proportional Scaling
// ---------------------------------------------------------------------------

describe('proportional-scaling', () => {
  it('scales all meals proportionally for a kcal violation', () => {
    // Day totals 1500 kcal but target is 1600 -> needs +6.67% scale
    const day = makeDay({ targetKcal: 1600 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = proportionalScaling.attempt(day, violation);
    expect(result).not.toBeNull();
    expect(result!.adjustedDay.dailyTotals.kcal).toBeGreaterThan(day.dailyTotals.kcal);
    expect(result!.description).toContain('proportional-scaling');
  });

  it('returns null when scale factor exceeds guard range', () => {
    // Day totals 1500 kcal but target is 3000 -> 2x scale, out of 0.75-1.25 range
    const day = makeDay({ targetKcal: 3000 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = proportionalScaling.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('handles macro violations with macroTargets', () => {
    const day = makeDay({
      targetKcal: 1500,
      macroTargets: { proteinG: 110, carbsG: 150, fatG: 50 },
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 12,
      offendingMacros: ['protein'],
    };

    const result = proportionalScaling.attempt(day, violation);
    // Protein is 100g vs target 110g -> scale = 1.1 (within range)
    expect(result).not.toBeNull();
    expect(result!.adjustedDay.dailyTotals.proteinG).toBeGreaterThan(day.dailyTotals.proteinG);
  });

  it('returns null for zero-kcal day', () => {
    const day = makeDay({
      meals: [],
      dailyTotals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    });
    const violation: Violation = { dayIndex: 0, type: 'kcal', variancePercent: -100 };

    expect(proportionalScaling.attempt(day, violation)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selective Scaling
// ---------------------------------------------------------------------------

describe('selective-scaling', () => {
  it('scales only the highest-kcal meal for kcal violation', () => {
    const day = makeDay({ targetKcal: 1600 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = selectiveScaling.attempt(day, violation);
    expect(result).not.toBeNull();
    expect(result!.description).toContain('selective-scaling');
    // Only one meal should change
    const unchangedCount = result!.adjustedDay.meals.filter(
      (m, i) => m.nutrition.kcal === day.meals[i].nutrition.kcal
    ).length;
    // At least 2 of 3 meals should be unchanged (only 1 is scaled)
    expect(unchangedCount).toBeGreaterThanOrEqual(2);
  });

  it('returns null when scale factor exceeds 2.0x guard', () => {
    // Day totals 1500 kcal but target is 3000 -> gap of 1500 kcal
    // Worst meal is 600 kcal, needs to become 2100 -> 3.5x scale
    const day = makeDay({ targetKcal: 3000 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = selectiveScaling.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null for empty meals', () => {
    const day = makeDay({
      meals: [],
      dailyTotals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    });
    const violation: Violation = { dayIndex: 0, type: 'kcal', variancePercent: -100 };

    expect(selectiveScaling.attempt(day, violation)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Snack Adjustment
// ---------------------------------------------------------------------------

describe('snack-adjustment', () => {
  it('adds a snack when under target by > 100 kcal', () => {
    // Day totals 1500 kcal, target 1700 -> deficit of 200 kcal
    const day = makeDay({ targetKcal: 1700 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = snackAdjustment.attempt(day, violation);
    expect(result).not.toBeNull();
    expect(result!.adjustedDay.meals.length).toBe(day.meals.length + 1);
    expect(result!.description).toContain('snack-adjustment');
    // The new meal should be a snack
    const newMeal = result!.adjustedDay.meals[result!.adjustedDay.meals.length - 1];
    expect(newMeal.slot).toContain('snack');
  });

  it('removes or reduces a snack when over target by > 100 kcal', () => {
    const snack = makeSnackMeal();
    const meals = [
      makeMeal({ slot: 'breakfast', nutrition: { kcal: 500, proteinG: 20, carbsG: 60, fatG: 15 } }),
      makeMeal({ slot: 'lunch', nutrition: { kcal: 600, proteinG: 40, carbsG: 50, fatG: 20 } }),
      makeMeal({ slot: 'dinner', nutrition: { kcal: 700, proteinG: 45, carbsG: 60, fatG: 25 } }),
      snack,
    ];
    // Total = 2000, target = 1800 -> surplus of 200
    const day = makeDay({ meals, targetKcal: 1800 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = snackAdjustment.attempt(day, violation);
    expect(result).not.toBeNull();
    expect(result!.description).toContain('snack-adjustment');
    // Should have removed the snack (200 kcal == surplus of 200)
    expect(result!.adjustedDay.meals.length).toBeLessThanOrEqual(day.meals.length);
  });

  it('returns null when gap is within dynamic threshold', () => {
    // Day totals 1500, target 1520 -> gap of 20 kcal
    // Dynamic threshold: max(30, 1520 * 0.02) = max(30, 30.4) = 30.4
    // 20 < 30.4 -> should return null
    const day = makeDay({ targetKcal: 1520 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = snackAdjustment.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null for macro violations', () => {
    const day = makeDay({
      targetKcal: 1700,
      macroTargets: { proteinG: 150, carbsG: 150, fatG: 50 },
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 15,
      offendingMacros: ['protein'],
    };

    const result = snackAdjustment.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null when over target but no snack meals exist', () => {
    const meals = [
      makeMeal({ slot: 'breakfast', nutrition: { kcal: 700, proteinG: 30, carbsG: 80, fatG: 20 } }),
      makeMeal({ slot: 'lunch', nutrition: { kcal: 700, proteinG: 40, carbsG: 60, fatG: 25 } }),
      makeMeal({ slot: 'dinner', nutrition: { kcal: 700, proteinG: 45, carbsG: 60, fatG: 25 } }),
    ];
    // Total = 2100, target = 1800 -> surplus of 300
    const day = makeDay({ meals, targetKcal: 1800 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = snackAdjustment.attempt(day, violation);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ingredient Substitution
// ---------------------------------------------------------------------------

describe('ingredient-substitution', () => {
  it('swaps rice for quinoa when protein is deficient', () => {
    const day = makeDay({
      targetKcal: 1500,
      macroTargets: { proteinG: 130, carbsG: 150, fatG: 50 },
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 15,
      offendingMacros: ['protein'],
    };

    const result = ingredientSubstitution.attempt(day, violation);
    expect(result).not.toBeNull();
    expect(result!.description).toContain('ingredient-substitution');
    expect(result!.description).toContain('quinoa');

    // Verify the substitution happened in ingredients
    const allIngredients = result!.adjustedDay.meals.flatMap((m) => m.ingredients);
    const hasQuinoa = allIngredients.some((ing) => ing.name.toLowerCase().includes('quinoa'));
    expect(hasQuinoa).toBe(true);
  });

  it('returns null for kcal violations', () => {
    const day = makeDay({ targetKcal: 1600 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    const result = ingredientSubstitution.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null when protein is not an offending macro', () => {
    const day = makeDay({
      targetKcal: 1500,
      macroTargets: { proteinG: 100, carbsG: 200, fatG: 50 },
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 20,
      offendingMacros: ['carbs'],
    };

    const result = ingredientSubstitution.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null when protein exceeds target (surplus, not deficit)', () => {
    const day = makeDay({
      targetKcal: 1500,
      macroTargets: { proteinG: 80, carbsG: 150, fatG: 50 }, // protein target below actual
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 25,
      offendingMacros: ['protein'],
    };

    const result = ingredientSubstitution.attempt(day, violation);
    expect(result).toBeNull();
  });

  it('returns null when no substitutable ingredients are found', () => {
    const meals = [
      makeMeal({
        slot: 'lunch',
        ingredients: [
          { name: 'Chicken Breast', amount: 200, unit: 'g' },
          { name: 'Sweet Potato', amount: 200, unit: 'g' },
          { name: 'Broccoli', amount: 150, unit: 'g' },
        ],
      }),
    ];
    const day = makeDay({
      meals,
      targetKcal: 500,
      macroTargets: { proteinG: 60, carbsG: 50, fatG: 15 },
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 15,
      offendingMacros: ['protein'],
    };

    const result = ingredientSubstitution.attempt(day, violation);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cascade Fallback Behavior
// ---------------------------------------------------------------------------

describe('cascade fallback behavior', () => {
  const CASCADE: RepairStrategy[] = [
    proportionalScaling,
    selectiveScaling,
    snackAdjustment,
    ingredientSubstitution,
  ];

  it('falls through to second strategy when first fails', () => {
    // Create a case where proportional scaling fails (scale factor > 1.35 dynamic guard)
    // but selective scaling succeeds (scale factor within 0.5-2.0 for one meal)
    const meals = [
      makeMeal({ slot: 'breakfast', nutrition: { kcal: 100, proteinG: 5, carbsG: 15, fatG: 2 } }),
      makeMeal({ slot: 'lunch', nutrition: { kcal: 300, proteinG: 25, carbsG: 30, fatG: 10 } }),
      makeMeal({ slot: 'dinner', nutrition: { kcal: 200, proteinG: 15, carbsG: 20, fatG: 8 } }),
    ];
    // Total = 600 kcal, target = 850 -> scale factor = 1.417 (outside 0.65-1.35 for <1500 plans)
    // But selective can scale the 300 kcal meal: needs to add 250 kcal -> 550/300 = 1.83x (within 0.5-2.0)
    const day = makeDay({ meals, targetKcal: 850 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    // Proportional scaling should fail (1.417 > 1.35 dynamic guard for <1500 plans)
    expect(proportionalScaling.attempt(day, violation)).toBeNull();

    // Selective scaling should succeed
    const selectiveResult = selectiveScaling.attempt(day, violation);
    expect(selectiveResult).not.toBeNull();

    // Full cascade should use selective-scaling
    let result = null;
    for (const strategy of CASCADE) {
      result = strategy.attempt(day, violation);
      if (result) break;
    }
    expect(result).not.toBeNull();
    expect(result!.description).toContain('selective-scaling');
  });

  it('falls through to snack-adjustment when scaling strategies fail', () => {
    // Both scaling strategies fail but snack-adjustment works
    const meals = [
      makeMeal({ slot: 'breakfast', nutrition: { kcal: 150, proteinG: 8, carbsG: 20, fatG: 4 } }),
      makeMeal({ slot: 'lunch', nutrition: { kcal: 150, proteinG: 10, carbsG: 18, fatG: 5 } }),
      makeMeal({ slot: 'dinner', nutrition: { kcal: 150, proteinG: 12, carbsG: 15, fatG: 6 } }),
    ];
    // Total = 450, target = 700 -> gap = 250 kcal
    // Proportional: 700/450 = 1.56 (outside 0.75-1.25)
    // Selective: biggest meal is 150, needs to add 250 -> 400/150 = 2.67x (outside 0.5-2.0)
    // Snack: gap > 100, so add a snack
    const day = makeDay({ meals, targetKcal: 700 });
    const violation: Violation = {
      dayIndex: 0,
      type: 'kcal',
      variancePercent: day.variancePercent,
    };

    expect(proportionalScaling.attempt(day, violation)).toBeNull();
    expect(selectiveScaling.attempt(day, violation)).toBeNull();

    let result = null;
    for (const strategy of CASCADE) {
      result = strategy.attempt(day, violation);
      if (result) break;
    }
    expect(result).not.toBeNull();
    expect(result!.description).toContain('snack-adjustment');
  });

  it('returns null when all strategies fail', () => {
    // Construct a scenario where NO strategy can help:
    // - Macro violation for fat (not protein, so ingredient-substitution won't fire)
    // - Not a kcal violation (so snack-adjustment won't fire)
    // - Scale factor extreme enough to exceed both guards
    // A single tiny meal with massive fat deficit:
    //   actual fat = 5g, target fat = 60g -> proportional scale = 60/5 = 12x (outside 0.75-1.25)
    //   selective kcal gap = (60-5)*9 = 495 kcal -> (100+495)/100 = 5.95x (outside 0.5-2.0)
    const meals = [
      makeMeal({
        slot: 'lunch',
        nutrition: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 5 },
        ingredients: [
          { name: 'Chicken Breast', amount: 100, unit: 'g' },
          { name: 'Steamed Vegetables', amount: 100, unit: 'g' },
        ],
      }),
    ];
    const day = makeDay({
      meals,
      targetKcal: 100,
      macroTargets: { proteinG: 10, carbsG: 10, fatG: 60 }, // fat massively off: 5 vs 60
      dailyTotals: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 5 },
      varianceKcal: 0,
      variancePercent: 0,
    });
    const violation: Violation = {
      dayIndex: 0,
      type: 'macro',
      variancePercent: 91.67, // |5-60|/60 ~ 91.67%
      offendingMacros: ['fat'],
    };

    let result = null;
    for (const strategy of CASCADE) {
      result = strategy.attempt(day, violation);
      if (result) break;
    }

    expect(result).toBeNull();
  });
});
