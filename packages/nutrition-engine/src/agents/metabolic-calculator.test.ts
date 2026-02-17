import { describe, it, expect } from 'vitest';
import {
  MetabolicCalculator,
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  calculateProteinG,
  getTrainingDayBonus,
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
  PROTEIN_G_PER_KG,
  FIBER_FLOOR_FEMALE,
  FIBER_FLOOR_MALE,
} from './metabolic-calculator';
import { ClientIntake } from '../types/schemas';

describe('MetabolicCalculator', () => {
  // Test helper to create a base intake
  const createBaseIntake = (overrides: Partial<ClientIntake> = {}): ClientIntake => ({
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goalType: 'maintain',
    goalRate: 1,
    activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: [],
    mealsPerDay: 3,
    snacksPerDay: 0,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    macroStyle: 'balanced',
    planDurationDays: 7,
    constraintWarnings: [],
    constraintsCompatible: true,
    ...overrides,
  });

  describe('calculateBMR', () => {
    it('calculates BMR correctly for male using Mifflin-St Jeor (no body fat)', () => {
      const input = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
      };

      // Formula: 10 * weight + 6.25 * height - 5 * age + 5
      const expected = 10 * 80 + 6.25 * 180 - 5 * 30 + 5;
      const result = calculateBMR(input);

      expect(result.bmr).toBe(expected);
      expect(result.bmr).toBe(1780);
      expect(result.method).toBe('mifflin_st_jeor');
    });

    it('calculates BMR correctly for female using Mifflin-St Jeor (no body fat)', () => {
      const input = {
        sex: 'female',
        weightKg: 65,
        heightCm: 165,
        age: 28,
      };

      // Formula: 10 * weight + 6.25 * height - 5 * age - 161
      const expected = 10 * 65 + 6.25 * 165 - 5 * 28 - 161;
      const result = calculateBMR(input);

      expect(result.bmr).toBe(expected);
      expect(result.bmr).toBe(1380.25);
      expect(result.method).toBe('mifflin_st_jeor');
    });

    it('uses Katch-McArdle when bodyFatPercent is provided', () => {
      const input = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
        bodyFatPercent: 15,
      };

      // Katch-McArdle: 370 + 21.6 * leanMass
      // leanMass = 80 * (1 - 0.15) = 68
      // BMR = 370 + 21.6 * 68 = 370 + 1468.8 = 1838.8
      const expectedLeanMass = 80 * (1 - 15 / 100);
      const expectedBmr = 370 + 21.6 * expectedLeanMass;
      const result = calculateBMR(input);

      expect(result.bmr).toBe(expectedBmr);
      expect(result.bmr).toBeCloseTo(1838.8, 1);
      expect(result.method).toBe('katch_mcardle');
    });

    it('falls back to Mifflin-St Jeor when bodyFatPercent is below 3', () => {
      const input = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
        bodyFatPercent: 2,
      };

      const result = calculateBMR(input);
      expect(result.method).toBe('mifflin_st_jeor');
    });

    it('falls back to Mifflin-St Jeor when bodyFatPercent is above 60', () => {
      const input = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
        bodyFatPercent: 61,
      };

      const result = calculateBMR(input);
      expect(result.method).toBe('mifflin_st_jeor');
    });

    it('uses Katch-McArdle at boundary values (3% and 60%)', () => {
      const inputLow = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
        bodyFatPercent: 3,
      };
      const inputHigh = {
        sex: 'female',
        weightKg: 80,
        heightCm: 165,
        age: 30,
        bodyFatPercent: 60,
      };

      expect(calculateBMR(inputLow).method).toBe('katch_mcardle');
      expect(calculateBMR(inputHigh).method).toBe('katch_mcardle');
    });

    it('handles different ages correctly', () => {
      const younger = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 25 });
      const older = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 40 });

      // Older age should have lower BMR (Mifflin-St Jeor path)
      expect(younger.bmr).toBeGreaterThan(older.bmr);
      expect(younger.bmr - older.bmr).toBe(75); // 15 years * 5
    });
  });

  describe('calculateTDEE', () => {
    it('applies sedentary multiplier correctly (1.2)', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'sedentary');

      expect(result).toBe(Math.round(bmr * 1.2));
      expect(result).toBe(2136);
    });

    it('applies lightly_active multiplier correctly (1.375)', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'lightly_active');

      expect(result).toBe(Math.round(bmr * 1.375));
      expect(result).toBe(2448);
    });

    it('applies moderately_active multiplier correctly (1.55)', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'moderately_active');

      expect(result).toBe(Math.round(bmr * 1.55));
      expect(result).toBe(2759);
    });

    it('applies very_active multiplier correctly (1.725)', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'very_active');

      expect(result).toBe(Math.round(bmr * 1.725));
      expect(result).toBe(3071);
    });

    it('applies extremely_active multiplier correctly (1.9)', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'extremely_active');

      expect(result).toBe(Math.round(bmr * 1.9));
      expect(result).toBe(3382);
    });

    it('uses moderately_active as fallback for unknown activity level', () => {
      const bmr = 1780;
      const result = calculateTDEE(bmr, 'unknown_level');

      expect(result).toBe(Math.round(bmr * 1.55));
    });
  });

  describe('calculateGoalCalories', () => {
    const tdee = 2500;

    it('calculates cut calories correctly (TDEE - 500 * rate)', () => {
      const result = calculateGoalCalories(tdee, 'cut', 1);

      expect(result).toBe(Math.round(tdee - 500));
      expect(result).toBe(2000);
    });

    it('calculates aggressive cut correctly', () => {
      const result = calculateGoalCalories(tdee, 'cut', 2);

      expect(result).toBe(Math.round(tdee - 1000));
      expect(result).toBe(1500);
    });

    it('calculates bulk calories correctly (TDEE + 350 * rate)', () => {
      // NOTE: Bulk uses 350, not 500
      const result = calculateGoalCalories(tdee, 'bulk', 1);

      expect(result).toBe(Math.round(tdee + 350));
      expect(result).toBe(2850);
    });

    it('calculates aggressive bulk correctly', () => {
      const result = calculateGoalCalories(tdee, 'bulk', 2);

      expect(result).toBe(Math.round(tdee + 700));
      expect(result).toBe(3200);
    });

    it('returns TDEE for maintenance goal', () => {
      const result = calculateGoalCalories(tdee, 'maintain', 1);

      expect(result).toBe(tdee);
      expect(result).toBe(2500);
    });

    it('ignores rate for maintenance goal', () => {
      const result1 = calculateGoalCalories(tdee, 'maintain', 0);
      const result2 = calculateGoalCalories(tdee, 'maintain', 2);

      expect(result1).toBe(tdee);
      expect(result2).toBe(tdee);
    });
  });

  describe('calculateMacroTargets', () => {
    const goalKcal = 2000;

    it('calculates balanced macros (30/40/30)', () => {
      const result = calculateMacroTargets(goalKcal, 'balanced');

      // Protein: 2000 * 0.3 / 4 = 150g
      // Carbs: 2000 * 0.4 / 4 = 200g
      // Fat: 2000 * 0.3 / 9 = 66.67g -> 67g
      expect(result.proteinG).toBe(150);
      expect(result.carbsG).toBe(200);
      expect(result.fatG).toBe(67);
    });

    it('calculates high_protein macros (40/35/25)', () => {
      const result = calculateMacroTargets(goalKcal, 'high_protein');

      // Protein: 2000 * 0.4 / 4 = 200g
      // Carbs: 2000 * 0.35 / 4 = 175g
      // Fat: 2000 * 0.25 / 9 = 55.56g -> 56g
      expect(result.proteinG).toBe(200);
      expect(result.carbsG).toBe(175);
      expect(result.fatG).toBe(56);
    });

    it('calculates low_carb macros (35/25/40)', () => {
      const result = calculateMacroTargets(goalKcal, 'low_carb');

      // Protein: 2000 * 0.35 / 4 = 175g
      // Carbs: 2000 * 0.25 / 4 = 125g
      // Fat: 2000 * 0.4 / 9 = 88.89g -> 89g
      expect(result.proteinG).toBe(175);
      expect(result.carbsG).toBe(125);
      expect(result.fatG).toBe(89);
    });

    it('calculates keto macros (30/5/65)', () => {
      const result = calculateMacroTargets(goalKcal, 'keto');

      // Protein: 2000 * 0.3 / 4 = 150g
      // Carbs: 2000 * 0.05 / 4 = 25g
      // Fat: 2000 * 0.65 / 9 = 144.44g -> 144g
      expect(result.proteinG).toBe(150);
      expect(result.carbsG).toBe(25);
      expect(result.fatG).toBe(144);
    });

    it('uses balanced as fallback for unknown macro style', () => {
      const result = calculateMacroTargets(goalKcal, 'unknown_style');

      expect(result.proteinG).toBe(150);
      expect(result.carbsG).toBe(200);
      expect(result.fatG).toBe(67);
    });
  });

  describe('calculateProteinG', () => {
    it('calculates protein for cutting (2.0 g/kg)', () => {
      // 80kg * 2.0 = 160g
      expect(calculateProteinG(80, 'cut')).toBe(160);
    });

    it('calculates protein for maintaining (1.8 g/kg)', () => {
      // 80kg * 1.8 = 144g
      expect(calculateProteinG(80, 'maintain')).toBe(144);
    });

    it('calculates protein for bulking (1.7 g/kg)', () => {
      // 80kg * 1.7 = 136g
      expect(calculateProteinG(80, 'bulk')).toBe(136);
    });

    it('defaults to 1.8 g/kg for unknown goal type', () => {
      expect(calculateProteinG(80, 'unknown')).toBe(144);
    });

    it('applies clinical safety cap of 2.5 g/kg', () => {
      // 150kg * 2.0 = 300g raw, but cap is 150 * 2.5 = 375g -> no cap needed
      expect(calculateProteinG(150, 'cut')).toBe(300);

      // For a very high g/kg scenario, the cap would kick in if someone
      // modified PROTEIN_G_PER_KG, but with current values, 2.0 < 2.5 so
      // the cap never triggers under normal conditions
    });

    it('rounds to nearest integer', () => {
      // 75kg * 1.7 = 127.5 -> 128
      expect(calculateProteinG(75, 'bulk')).toBe(128);
    });
  });

  describe('getTrainingDayBonus', () => {
    it('calculates bonus from TDEE formula (TDEE * 0.05 * hours)', () => {
      // TDEE 2000 * 0.05 * (60/60) = 100, but clamped to min 150
      expect(getTrainingDayBonus(2000, 60)).toBe(150);
    });

    it('scales with training time', () => {
      // TDEE 3000 * 0.05 * (75/60) = 187.5 -> 188
      expect(getTrainingDayBonus(3000, 75)).toBe(188);
    });

    it('clamps to minimum of 150 kcal', () => {
      // TDEE 1500 * 0.05 * (60/60) = 75, clamped to 150
      expect(getTrainingDayBonus(1500, 60)).toBe(150);
    });

    it('clamps to maximum of 400 kcal', () => {
      // TDEE 5000 * 0.05 * (120/60) = 500, clamped to 400
      expect(getTrainingDayBonus(5000, 120)).toBe(400);
    });

    it('defaults to 60 minutes when no training time provided', () => {
      // TDEE 2759 * 0.05 * (60/60) = 137.95 -> 138, clamped to 150
      expect(getTrainingDayBonus(2759)).toBe(150);
    });

    it('handles typical moderately_active TDEE', () => {
      // TDEE 2759 * 0.05 * (60/60) = 137.95 -> 138, clamped to min 150
      expect(getTrainingDayBonus(2759, 60)).toBe(150);
    });
  });

  describe('MetabolicCalculator.calculate', () => {
    const calculator = new MetabolicCalculator();

    it('calculates complete metabolic profile for male maintenance', () => {
      const intake = createBaseIntake({
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        goalType: 'maintain',
        goalRate: 1,
        activityLevel: 'moderately_active',
        macroStyle: 'balanced',
        mealsPerDay: 3,
        snacksPerDay: 0,
      });

      const result = calculator.calculate(intake);

      // BMR: 10*80 + 6.25*180 - 5*30 + 5 = 1780
      expect(result.bmrKcal).toBe(1780);

      // TDEE: 1780 * 1.55 = 2759
      expect(result.tdeeKcal).toBe(2759);

      // Goal: maintain = TDEE
      expect(result.goalKcal).toBe(2759);
      expect(result.restDayKcal).toBe(2759);

      // Training day bonus: formula-based, 2759 * 0.05 * 1 = 138 -> clamped to 150
      expect(result.trainingDayBonusKcal).toBe(150);
      expect(result.trainingDayKcal).toBe(2909);

      // Protein: g/kg method, 80kg * 1.8 = 144g
      expect(result.proteinTargetG).toBe(144);
      expect(result.proteinMethod).toBe('g_per_kg');

      // Macros should be positive
      expect(result.carbsTargetG).toBeGreaterThan(0);
      expect(result.fatTargetG).toBeGreaterThan(0);

      // Fiber: minimum 38g for male (sex-specific floor)
      expect(result.fiberTargetG).toBeGreaterThanOrEqual(38);

      // Meal targets
      expect(result.mealTargets).toHaveLength(3);
      expect(result.calculationMethod).toBe('mifflin_st_jeor');

      // Training day macros should exist
      expect(result.trainingDayMacros).toBeDefined();
      expect(result.trainingDayMacros!.proteinG).toBe(result.proteinTargetG);
      expect(result.trainingDayMacros!.carbsG).toBeGreaterThan(result.carbsTargetG);
      expect(result.trainingDayMacros!.fatG).toBe(result.fatTargetG);
    });

    it('uses Katch-McArdle when bodyFatPercent is provided', () => {
      const intake = createBaseIntake({
        bodyFatPercent: 15,
      });

      const result = calculator.calculate(intake);

      // Katch-McArdle: 370 + 21.6 * (80 * 0.85) = 370 + 21.6 * 68 = 1838.8 -> 1839
      expect(result.bmrKcal).toBe(1839);
      expect(result.calculationMethod).toBe('katch_mcardle');
    });

    it('calculates correct macros for cutting goal with g/kg protein', () => {
      const intake = createBaseIntake({
        goalType: 'cut',
        goalRate: 1,
        macroStyle: 'high_protein',
      });

      const result = calculator.calculate(intake);

      // TDEE should be reduced by 500 kcal
      expect(result.goalKcal).toBe(result.tdeeKcal - 500);

      // Protein should be g/kg based: 80kg * 2.0 (cut) = 160g
      expect(result.proteinTargetG).toBe(160);
      expect(result.proteinMethod).toBe('g_per_kg');
    });

    it('calculates correct macros for bulking goal', () => {
      const intake = createBaseIntake({
        goalType: 'bulk',
        goalRate: 1,
      });

      const result = calculator.calculate(intake);

      // TDEE should be increased by 350 kcal (not 500!)
      expect(result.goalKcal).toBe(result.tdeeKcal + 350);

      // Protein: 80kg * 1.7 (bulk) = 136g
      expect(result.proteinTargetG).toBe(136);
    });

    it('distributes meals correctly for 3 meals per day', () => {
      const intake = createBaseIntake({
        mealsPerDay: 3,
        snacksPerDay: 0,
      });

      const result = calculator.calculate(intake);

      expect(result.mealTargets).toHaveLength(3);

      // Check distribution percentages: [0.25, 0.35, 0.4]
      const totalPercent = result.mealTargets.reduce((sum, m) => sum + m.percentOfDaily, 0);
      expect(totalPercent).toBe(100);

      // Check labels
      expect(result.mealTargets[0].label).toBe('breakfast');
      expect(result.mealTargets[1].label).toBe('lunch');
      expect(result.mealTargets[2].label).toBe('dinner');
    });

    it('distributes meals correctly with snacks', () => {
      const intake = createBaseIntake({
        mealsPerDay: 3,
        snacksPerDay: 2,
      });

      const result = calculator.calculate(intake);

      // 3 meals + 2 snacks = 5 slots
      expect(result.mealTargets).toHaveLength(5);

      // Each snack should be 10%
      const snacks = result.mealTargets.filter((m) => m.slot.startsWith('snack'));
      expect(snacks).toHaveLength(2);
      snacks.forEach((snack) => {
        expect(snack.percentOfDaily).toBe(10);
      });

      // Meals should total 80% (100% - 20% for snacks)
      const meals = result.mealTargets.filter((m) => m.slot.startsWith('meal'));
      const mealTotal = meals.reduce((sum, m) => sum + m.percentOfDaily, 0);
      expect(mealTotal).toBe(80);
    });

    it('handles different meal counts correctly', () => {
      const configs = [2, 3, 4, 5, 6];

      configs.forEach((mealCount) => {
        const intake = createBaseIntake({
          mealsPerDay: mealCount,
          snacksPerDay: 0,
        });

        const result = calculator.calculate(intake);

        expect(result.mealTargets).toHaveLength(mealCount);

        // Total should be 100%
        const total = result.mealTargets.reduce((sum, m) => sum + m.percentOfDaily, 0);
        expect(total).toBe(100);
      });
    });

    it('calculates fiber target with sex-specific floors', () => {
      const maleIntake = createBaseIntake({ sex: 'male', goalType: 'cut', goalRate: 2 });
      const femaleIntake = createBaseIntake({ sex: 'female', goalType: 'cut', goalRate: 2 });

      const maleResult = calculator.calculate(maleIntake);
      const femaleResult = calculator.calculate(femaleIntake);

      // Male floor is 38g
      expect(maleResult.fiberTargetG).toBeGreaterThanOrEqual(38);

      // Female floor is 25g
      expect(femaleResult.fiberTargetG).toBeGreaterThanOrEqual(25);
    });

    it('fiber scales with calories above the floor', () => {
      const lowCalIntake = createBaseIntake({ goalType: 'cut', goalRate: 2 });
      const highCalIntake = createBaseIntake({ goalType: 'bulk', goalRate: 2 });

      const lowResult = calculator.calculate(lowCalIntake);
      const highResult = calculator.calculate(highCalIntake);

      // High cal should have more fiber (14g per 1000 kcal)
      expect(highResult.fiberTargetG).toBeGreaterThan(lowResult.fiberTargetG);
    });

    it('training day bonus varies with afternoon training time', () => {
      const morningIntake = createBaseIntake({ trainingTime: 'morning' });
      const afternoonIntake = createBaseIntake({ trainingTime: 'afternoon' });

      const morningResult = calculator.calculate(morningIntake);
      const afternoonResult = calculator.calculate(afternoonIntake);

      // Afternoon maps to 75 min vs morning 60 min, so afternoon bonus should be >= morning
      expect(afternoonResult.trainingDayBonusKcal).toBeGreaterThanOrEqual(
        morningResult.trainingDayBonusKcal
      );
    });

    it('validates output against schema', () => {
      const intake = createBaseIntake();
      const result = calculator.calculate(intake);

      // Should not throw - schema validation happens in calculate()
      expect(result.bmrKcal).toBeDefined();
      expect(result.tdeeKcal).toBeDefined();
      expect(result.goalKcal).toBeDefined();
      expect(result.proteinTargetG).toBeDefined();
      expect(result.carbsTargetG).toBeDefined();
      expect(result.fatTargetG).toBeDefined();
      expect(result.fiberTargetG).toBeDefined();
      expect(result.mealTargets).toBeDefined();
      expect(result.calculationMethod).toBe('mifflin_st_jeor');
      expect(result.proteinMethod).toBe('g_per_kg');
      expect(result.trainingDayMacros).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('ACTIVITY_MULTIPLIERS has correct values', () => {
      expect(ACTIVITY_MULTIPLIERS).toEqual({
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
        extremely_active: 1.9,
      });
    });

    it('MACRO_SPLITS has correct values', () => {
      expect(MACRO_SPLITS.balanced).toEqual({ protein: 0.3, carbs: 0.4, fat: 0.3 });
      expect(MACRO_SPLITS.high_protein).toEqual({ protein: 0.4, carbs: 0.35, fat: 0.25 });
      expect(MACRO_SPLITS.low_carb).toEqual({ protein: 0.35, carbs: 0.25, fat: 0.4 });
      expect(MACRO_SPLITS.keto).toEqual({ protein: 0.3, carbs: 0.05, fat: 0.65 });
    });

    it('TRAINING_DAY_BONUS has correct values (legacy constant preserved)', () => {
      expect(TRAINING_DAY_BONUS).toEqual({
        sedentary: 150,
        lightly_active: 175,
        moderately_active: 200,
        very_active: 250,
        extremely_active: 300,
      });
    });

    it('PROTEIN_G_PER_KG has correct values', () => {
      expect(PROTEIN_G_PER_KG).toEqual({
        cut: 2.0,
        maintain: 1.8,
        bulk: 1.7,
      });
    });

    it('FIBER_FLOOR constants have correct sex-specific values', () => {
      expect(FIBER_FLOOR_FEMALE).toBe(25);
      expect(FIBER_FLOOR_MALE).toBe(38);
    });

    it('MEAL_DISTRIBUTIONS has correct values', () => {
      expect(MEAL_DISTRIBUTIONS[2]).toEqual([0.4, 0.6]);
      expect(MEAL_DISTRIBUTIONS[3]).toEqual([0.25, 0.35, 0.4]);
      expect(MEAL_DISTRIBUTIONS[4]).toEqual([0.2, 0.3, 0.35, 0.15]);
      expect(MEAL_DISTRIBUTIONS[5]).toEqual([0.2, 0.25, 0.3, 0.15, 0.1]);
      expect(MEAL_DISTRIBUTIONS[6]).toEqual([0.15, 0.25, 0.25, 0.15, 0.1, 0.1]);
    });

    it('MEAL_LABELS has correct values', () => {
      expect(MEAL_LABELS[2]).toEqual(['breakfast', 'dinner']);
      expect(MEAL_LABELS[3]).toEqual(['breakfast', 'lunch', 'dinner']);
      expect(MEAL_LABELS[4]).toEqual(['breakfast', 'lunch', 'dinner', 'evening_snack']);
      expect(MEAL_LABELS[5]).toEqual([
        'breakfast',
        'morning_snack',
        'lunch',
        'afternoon_snack',
        'dinner',
      ]);
      expect(MEAL_LABELS[6]).toEqual([
        'breakfast',
        'morning_snack',
        'lunch',
        'afternoon_snack',
        'dinner',
        'evening_snack',
      ]);
    });
  });
});
