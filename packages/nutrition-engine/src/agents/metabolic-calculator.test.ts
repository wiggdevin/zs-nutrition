import { describe, it, expect } from 'vitest';
import {
  MetabolicCalculator,
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  getTrainingDayBonus,
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
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
    ...overrides,
  });

  describe('calculateBMR', () => {
    it('calculates BMR correctly for male using Mifflin-St Jeor', () => {
      const input = {
        sex: 'male',
        weightKg: 80,
        heightCm: 180,
        age: 30,
      };

      // Formula: 10 * weight + 6.25 * height - 5 * age + 5
      const expected = 10 * 80 + 6.25 * 180 - 5 * 30 + 5;
      const result = calculateBMR(input);

      expect(result).toBe(expected);
      expect(result).toBe(1780);
    });

    it('calculates BMR correctly for female using Mifflin-St Jeor', () => {
      const input = {
        sex: 'female',
        weightKg: 65,
        heightCm: 165,
        age: 28,
      };

      // Formula: 10 * weight + 6.25 * height - 5 * age - 161
      // 10 * 65 = 650
      // 6.25 * 165 = 1031.25
      // 5 * 28 = 140
      // 650 + 1031.25 - 140 - 161 = 1380.25
      const expected = 10 * 65 + 6.25 * 165 - 5 * 28 - 161;
      const result = calculateBMR(input);

      expect(result).toBe(expected);
      expect(result).toBe(1380.25);
    });

    it('handles different ages correctly', () => {
      const younger = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 25 });
      const older = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 40 });

      // Older age should have lower BMR
      expect(younger).toBeGreaterThan(older);
      expect(younger - older).toBe(75); // 15 years * 5
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
      // Fat: 2000 * 0.3 / 9 = 66.67g ≈ 67g
      expect(result.proteinG).toBe(150);
      expect(result.carbsG).toBe(200);
      expect(result.fatG).toBe(67);
    });

    it('calculates high_protein macros (40/35/25)', () => {
      const result = calculateMacroTargets(goalKcal, 'high_protein');

      // Protein: 2000 * 0.4 / 4 = 200g
      // Carbs: 2000 * 0.35 / 4 = 175g
      // Fat: 2000 * 0.25 / 9 = 55.56g ≈ 56g
      expect(result.proteinG).toBe(200);
      expect(result.carbsG).toBe(175);
      expect(result.fatG).toBe(56);
    });

    it('calculates low_carb macros (35/25/40)', () => {
      const result = calculateMacroTargets(goalKcal, 'low_carb');

      // Protein: 2000 * 0.35 / 4 = 175g
      // Carbs: 2000 * 0.25 / 4 = 125g
      // Fat: 2000 * 0.4 / 9 = 88.89g ≈ 89g
      expect(result.proteinG).toBe(175);
      expect(result.carbsG).toBe(125);
      expect(result.fatG).toBe(89);
    });

    it('calculates keto macros (30/5/65)', () => {
      const result = calculateMacroTargets(goalKcal, 'keto');

      // Protein: 2000 * 0.3 / 4 = 150g
      // Carbs: 2000 * 0.05 / 4 = 25g
      // Fat: 2000 * 0.65 / 9 = 144.44g ≈ 144g
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

  describe('getTrainingDayBonus', () => {
    it('returns correct bonus for sedentary (150 kcal)', () => {
      expect(getTrainingDayBonus('sedentary')).toBe(150);
    });

    it('returns correct bonus for lightly_active (175 kcal)', () => {
      expect(getTrainingDayBonus('lightly_active')).toBe(175);
    });

    it('returns correct bonus for moderately_active (200 kcal)', () => {
      expect(getTrainingDayBonus('moderately_active')).toBe(200);
    });

    it('returns correct bonus for very_active (250 kcal)', () => {
      expect(getTrainingDayBonus('very_active')).toBe(250);
    });

    it('returns correct bonus for extremely_active (300 kcal)', () => {
      expect(getTrainingDayBonus('extremely_active')).toBe(300);
    });

    it('returns default 200 kcal for unknown activity level', () => {
      expect(getTrainingDayBonus('unknown')).toBe(200);
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

      // Training day bonus: moderately_active = 200
      expect(result.trainingDayBonusKcal).toBe(200);
      expect(result.trainingDayKcal).toBe(2959);

      // Macros (balanced: 30/40/30)
      expect(result.proteinTargetG).toBeGreaterThan(0);
      expect(result.carbsTargetG).toBeGreaterThan(0);
      expect(result.fatTargetG).toBeGreaterThan(0);

      // Fiber: minimum 25g or 14g per 1000 kcal
      expect(result.fiberTargetG).toBeGreaterThanOrEqual(25);

      // Meal targets
      expect(result.mealTargets).toHaveLength(3);
      expect(result.calculationMethod).toBe('mifflin_st_jeor');
    });

    it('calculates correct macros for cutting goal', () => {
      const intake = createBaseIntake({
        goalType: 'cut',
        goalRate: 1,
        macroStyle: 'high_protein',
      });

      const result = calculator.calculate(intake);

      // TDEE should be reduced by 500 kcal
      expect(result.goalKcal).toBe(result.tdeeKcal - 500);

      // High protein split: 40/35/25
      expect(result.macroSplit.proteinPercent).toBe(40);
      expect(result.macroSplit.carbsPercent).toBe(35);
      expect(result.macroSplit.fatPercent).toBe(25);
    });

    it('calculates correct macros for bulking goal', () => {
      const intake = createBaseIntake({
        goalType: 'bulk',
        goalRate: 1,
      });

      const result = calculator.calculate(intake);

      // TDEE should be increased by 350 kcal (not 500!)
      expect(result.goalKcal).toBe(result.tdeeKcal + 350);
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

    it('calculates fiber target correctly', () => {
      const lowCalIntake = createBaseIntake({ goalType: 'cut', goalRate: 2 });
      const highCalIntake = createBaseIntake({ goalType: 'bulk', goalRate: 2 });

      const lowResult = calculator.calculate(lowCalIntake);
      const highResult = calculator.calculate(highCalIntake);

      // Low cal should have minimum 25g
      expect(lowResult.fiberTargetG).toBeGreaterThanOrEqual(25);

      // High cal should have more fiber (14g per 1000 kcal)
      expect(highResult.fiberTargetG).toBeGreaterThan(lowResult.fiberTargetG);
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

    it('TRAINING_DAY_BONUS has correct values', () => {
      expect(TRAINING_DAY_BONUS).toEqual({
        sedentary: 150,
        lightly_active: 175,
        moderately_active: 200,
        very_active: 250,
        extremely_active: 300,
      });
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
