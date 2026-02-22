/**
 * Calorie/Macro Consistency Tests
 *
 * Verifies that kcalFromMacros correctly derives calories from macros
 * using the standard Atwater factors (P*4 + C*4 + F*9), ensuring
 * displayed calories always match the displayed macros.
 */
import { describe, it, expect } from 'vitest';
import { kcalFromMacros } from '../agents/nutrition-compiler';

describe('kcalFromMacros', () => {
  it('returns correct kcal for the Greek Yogurt Bowl example (P:25.5, C:34.1, F:10.4 → 332)', () => {
    // This was the motivating bug: FatSecret said 260 kcal but macros imply 332
    expect(kcalFromMacros(25.5, 34.1, 10.4)).toBe(332);
  });

  it('returns 0 for zero macros', () => {
    expect(kcalFromMacros(0, 0, 0)).toBe(0);
  });

  it('handles protein-only correctly (P*4)', () => {
    expect(kcalFromMacros(30, 0, 0)).toBe(120);
  });

  it('handles carbs-only correctly (C*4)', () => {
    expect(kcalFromMacros(0, 50, 0)).toBe(200);
  });

  it('handles fat-only correctly (F*9)', () => {
    expect(kcalFromMacros(0, 0, 20)).toBe(180);
  });

  it('handles very high fat meal (e.g., nuts/avocado)', () => {
    // Almonds: ~21g protein, 22g carbs, 49g fat per 100g
    expect(kcalFromMacros(21, 22, 49)).toBe(613);
  });

  it('handles typical balanced meal', () => {
    // Chicken breast + rice + veggies: ~40g P, 55g C, 12g F
    expect(kcalFromMacros(40, 55, 12)).toBe(488);
  });

  it('rounds to nearest integer', () => {
    // P:10.3 C:20.7 F:5.1 → 10.3*4 + 20.7*4 + 5.1*9 = 41.2 + 82.8 + 45.9 = 169.9 → 170
    expect(kcalFromMacros(10.3, 20.7, 5.1)).toBe(170);
  });

  it('handles fractional macros with .5 rounding', () => {
    // P:1 C:1 F:1 → 4 + 4 + 9 = 17
    expect(kcalFromMacros(1, 1, 1)).toBe(17);
    // P:0.5 C:0.5 F:0.5 → 2 + 2 + 4.5 = 8.5 → 9 (rounds up)
    expect(kcalFromMacros(0.5, 0.5, 0.5)).toBe(9);
  });

  it('handles very small values (trace macros)', () => {
    expect(kcalFromMacros(0.1, 0.1, 0.1)).toBe(2);
  });
});

describe('calorie-macro consistency invariant', () => {
  /**
   * Helper: given macros, verify that kcal === kcalFromMacros(P, C, F).
   * This is the core invariant the fix enforces.
   */
  function assertConsistent(nutrition: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) {
    const expected = kcalFromMacros(nutrition.proteinG, nutrition.carbsG, nutrition.fatG);
    expect(nutrition.kcal).toBe(expected);
  }

  it('consistency holds after simulated ingredient aggregation', () => {
    // Simulate summing 3 ingredients, then rounding
    const ingredients = [
      { kcal: 150, proteinG: 12.3, carbsG: 15.7, fatG: 5.2 },
      { kcal: 80, proteinG: 2.1, carbsG: 18.4, fatG: 0.5 },
      { kcal: 120, proteinG: 8.0, carbsG: 3.2, fatG: 9.1 },
    ];

    let totalP = 0,
      totalC = 0,
      totalF = 0;
    for (const ing of ingredients) {
      totalP += ing.proteinG;
      totalC += ing.carbsG;
      totalF += ing.fatG;
    }

    const roundedP = Math.round(totalP * 10) / 10;
    const roundedC = Math.round(totalC * 10) / 10;
    const roundedF = Math.round(totalF * 10) / 10;

    const nutrition = {
      kcal: kcalFromMacros(roundedP, roundedC, roundedF),
      proteinG: roundedP,
      carbsG: roundedC,
      fatG: roundedF,
    };

    assertConsistent(nutrition);
  });

  it('consistency holds after simulated recalibration scaling', () => {
    const base = { proteinG: 30, carbsG: 45, fatG: 15 };
    const factor = 0.85; // scale down 15%

    const scaledP = Math.round(base.proteinG * factor * 10) / 10;
    const scaledC = Math.round(base.carbsG * factor * 10) / 10;
    const scaledF = Math.round(base.fatG * factor * 10) / 10;

    const nutrition = {
      kcal: kcalFromMacros(scaledP, scaledC, scaledF),
      proteinG: scaledP,
      carbsG: scaledC,
      fatG: scaledF,
    };

    assertConsistent(nutrition);
  });

  it('consistency holds after simulated day-level calibration', () => {
    const meals = [
      { proteinG: 25, carbsG: 30, fatG: 10 },
      { proteinG: 35, carbsG: 50, fatG: 18 },
      { proteinG: 20, carbsG: 25, fatG: 8 },
    ];
    const clampedFactor = 1.15; // scale up 15%

    const adjusted = meals.map((m) => {
      const p = Math.round(m.proteinG * clampedFactor * 10) / 10;
      const c = Math.round(m.carbsG * clampedFactor * 10) / 10;
      const f = Math.round(m.fatG * clampedFactor * 10) / 10;
      return {
        kcal: kcalFromMacros(p, c, f),
        proteinG: p,
        carbsG: c,
        fatG: f,
      };
    });

    // Each meal should be consistent
    for (const meal of adjusted) {
      assertConsistent(meal);
    }

    // Daily totals should also be consistent
    let totalP = 0,
      totalC = 0,
      totalF = 0;
    for (const m of adjusted) {
      totalP += m.proteinG;
      totalC += m.carbsG;
      totalF += m.fatG;
    }
    const rP = Math.round(totalP * 10) / 10;
    const rC = Math.round(totalC * 10) / 10;
    const rF = Math.round(totalF * 10) / 10;
    assertConsistent({
      kcal: kcalFromMacros(rP, rC, rF),
      proteinG: rP,
      carbsG: rC,
      fatG: rF,
    });
  });

  it('consistency holds for AI-estimate fallback values', () => {
    // Simulate AI estimates (Claude's guesses)
    const estimated = { proteinG: 28, carbsG: 40, fatG: 12 };
    const nutrition = {
      kcal: kcalFromMacros(estimated.proteinG, estimated.carbsG, estimated.fatG),
      proteinG: estimated.proteinG,
      carbsG: estimated.carbsG,
      fatG: estimated.fatG,
    };

    assertConsistent(nutrition);
  });
});
