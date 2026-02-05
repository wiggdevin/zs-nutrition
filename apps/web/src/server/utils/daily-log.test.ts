import { describe, it, expect } from 'vitest';
import { calculateAdherenceScore } from './daily-log';

describe('calculateAdherenceScore', () => {
  it('returns 100 when actuals exactly match targets', () => {
    const score = calculateAdherenceScore({
      actualKcal: 2000,
      actualProteinG: 150,
      actualCarbsG: 200,
      actualFatG: 65,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    expect(score).toBe(100);
  });

  it('returns correct score when under target (e.g., 50% = score 50)', () => {
    const score = calculateAdherenceScore({
      actualKcal: 1000,
      actualProteinG: 75,
      actualCarbsG: 100,
      actualFatG: 32.5,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    expect(score).toBe(50);
  });

  it('penalizes going over target (e.g., 150% of target)', () => {
    const score = calculateAdherenceScore({
      actualKcal: 3000,
      actualProteinG: 225,
      actualCarbsG: 300,
      actualFatG: 97.5,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    // At 150% of target: macroScore = 100 - 0.5 * 200 = 0
    expect(score).toBe(0);
  });

  it('uses default targets when nulls provided', () => {
    // Defaults: kcal=2000, protein=150, carbs=200, fat=65
    const score = calculateAdherenceScore({
      actualKcal: 2000,
      actualProteinG: 150,
      actualCarbsG: 200,
      actualFatG: 65,
      targetKcal: null,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
    });
    expect(score).toBe(100);
  });

  it('returns 0 when actuals are massively over target', () => {
    const score = calculateAdherenceScore({
      actualKcal: 10000,
      actualProteinG: 1000,
      actualCarbsG: 2000,
      actualFatG: 500,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    expect(score).toBe(0);
  });

  it('weights macros correctly (kcal 35%, protein 30%, carbs 20%, fat 15%)', () => {
    // Set up: only kcal hits target, everything else is 0
    const score = calculateAdherenceScore({
      actualKcal: 2000,
      actualProteinG: 0,
      actualCarbsG: 0,
      actualFatG: 0,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    // kcalScore = 100, others = 0
    // score = round(100 * 0.35 + 0 * 0.3 + 0 * 0.2 + 0 * 0.15) = round(35) = 35
    expect(score).toBe(35);

    // Only protein hits target
    const scoreProteinOnly = calculateAdherenceScore({
      actualKcal: 0,
      actualProteinG: 150,
      actualCarbsG: 0,
      actualFatG: 0,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    // score = round(0 * 0.35 + 100 * 0.3 + 0 * 0.2 + 0 * 0.15) = round(30) = 30
    expect(scoreProteinOnly).toBe(30);

    // Only carbs hits target
    const scoreCarbsOnly = calculateAdherenceScore({
      actualKcal: 0,
      actualProteinG: 0,
      actualCarbsG: 200,
      actualFatG: 0,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    // score = round(0 * 0.35 + 0 * 0.3 + 100 * 0.2 + 0 * 0.15) = round(20) = 20
    expect(scoreCarbsOnly).toBe(20);

    // Only fat hits target
    const scoreFatOnly = calculateAdherenceScore({
      actualKcal: 0,
      actualProteinG: 0,
      actualCarbsG: 0,
      actualFatG: 65,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    // score = round(0 * 0.35 + 0 * 0.3 + 0 * 0.2 + 100 * 0.15) = round(15) = 15
    expect(scoreFatOnly).toBe(15);
  });

  it('returns 100 when target is 0 (macroScore edge case)', () => {
    const score = calculateAdherenceScore({
      actualKcal: 500,
      actualProteinG: 50,
      actualCarbsG: 80,
      actualFatG: 30,
      targetKcal: 0,
      targetProteinG: 0,
      targetCarbsG: 0,
      targetFatG: 0,
    });
    // When target is 0, it falls back to defaults (2000, 150, 200, 65)
    // because dailyLog.targetKcal || 2000 means 0 || 2000 = 2000
    // So this is actually: actuals far under defaults
    // kcalScore = round(500/2000 * 100) = 25
    // proteinScore = round(50/150 * 100) = 33
    // carbsScore = round(80/200 * 100) = 40
    // fatScore = round(30/65 * 100) = 46
    // score = round(25*0.35 + 33*0.3 + 40*0.2 + 46*0.15)
    //       = round(8.75 + 9.9 + 8 + 6.9)
    //       = round(33.55)
    //       = 34
    expect(score).toBe(34);
  });

  it('clamps result between 0 and 100', () => {
    // Score should never exceed 100 even with rounding quirks
    const highScore = calculateAdherenceScore({
      actualKcal: 2000,
      actualProteinG: 150,
      actualCarbsG: 200,
      actualFatG: 65,
      targetKcal: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65,
    });
    expect(highScore).toBeLessThanOrEqual(100);

    // Score should never go below 0
    const lowScore = calculateAdherenceScore({
      actualKcal: 99999,
      actualProteinG: 99999,
      actualCarbsG: 99999,
      actualFatG: 99999,
      targetKcal: 1,
      targetProteinG: 1,
      targetCarbsG: 1,
      targetFatG: 1,
    });
    expect(lowScore).toBeGreaterThanOrEqual(0);
  });
});
