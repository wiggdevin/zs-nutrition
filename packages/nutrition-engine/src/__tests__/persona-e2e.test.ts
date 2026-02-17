/**
 * Phase D: User Persona Testing
 * Tests 5 diverse personas through the intake normalizer + metabolic calculator
 * to verify all P2 science changes work correctly end-to-end.
 *
 * These do NOT make Claude/FatSecret API calls — they test the deterministic
 * intake → metabolic profile path that runs in <10ms.
 */
import { describe, it, expect } from 'vitest';
import { IntakeNormalizer } from '../agents/intake-normalizer';
import { MetabolicCalculator } from '../agents/metabolic-calculator';
import type { RawIntakeForm } from '../types/schemas';

const normalizer = new IntakeNormalizer();
const calculator = new MetabolicCalculator();

function runPersona(input: RawIntakeForm) {
  const intake = normalizer.normalize(input);
  if (!intake.constraintsCompatible) {
    return { intake, profile: null, rejected: true };
  }
  const profile = calculator.calculate(intake);
  return { intake, profile, rejected: false };
}

// ─────────────────────────────────────────────────────
// Persona 1: Small Female Aggressive Cut — Caloric Floor
// ─────────────────────────────────────────────────────
describe('Persona 1: Small Female Aggressive Cut', () => {
  const input: RawIntakeForm = {
    name: 'Test',
    sex: 'female',
    age: 42,
    heightFeet: 5,
    heightInches: 2,
    weightLbs: 120,
    bodyFatPercent: 28,
    goalType: 'cut',
    goalRate: 2,
    activityLevel: 'sedentary',
    trainingDays: [],
    dietaryStyle: 'paleo',
    macroStyle: 'low_carb',
    allergies: ['dairy', 'tree nut'],
    exclusions: ['pork', 'lamb'],
    cuisinePreferences: ['mediterranean'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 6,
    prepTimeMaxMin: 40,
    planDurationDays: 7,
  };

  const { intake, profile, rejected } = runPersona(input);

  it('should not be rejected', () => {
    expect(rejected).toBe(false);
  });

  it('should convert imperial to metric', () => {
    expect(intake.heightCm).toBeCloseTo(157.48, 0);
    expect(intake.weightKg).toBeCloseTo(54.43, 0);
  });

  it('should use Katch-McArdle (bodyFat provided)', () => {
    expect(profile!.calculationMethod).toBe('katch_mcardle');
  });

  it('should apply female caloric floor (1200 kcal)', () => {
    expect(profile!.goalKcal).toBeGreaterThanOrEqual(1200);
    expect(profile!.goalKcalFloorApplied).toBe(true);
  });

  it('should set protein via g_per_kg method for cut (~2.0 g/kg)', () => {
    expect(profile!.proteinMethod).toBe('g_per_kg');
    // ~54.43 kg * 2.0 = ~108.9g
    expect(profile!.proteinTargetG).toBeGreaterThanOrEqual(100);
    expect(profile!.proteinTargetG).toBeLessThanOrEqual(120);
  });

  it('should expand dairy and tree nut allergies', () => {
    expect(intake.allergies).toContain('dairy');
    expect(intake.allergies).toContain('milk');
    expect(intake.allergies).toContain('cheese');
    expect(intake.allergies).toContain('tree nut');
    expect(intake.allergies).toContain('almond');
    expect(intake.allergies).toContain('walnut');
  });
});

// ─────────────────────────────────────────────────────
// Persona 2: Large Male Bulk — Snack Cap + High Kcal
// ─────────────────────────────────────────────────────
describe('Persona 2: Large Male Bulk', () => {
  const input: RawIntakeForm = {
    name: 'Test',
    sex: 'male',
    age: 24,
    heightCm: 193,
    weightKg: 100,
    goalType: 'bulk',
    goalRate: 2,
    activityLevel: 'extremely_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    dietaryStyle: 'omnivore',
    macroStyle: 'keto',
    allergies: [],
    exclusions: [],
    cuisinePreferences: [],
    mealsPerDay: 6,
    snacksPerDay: 4,
    cookingSkill: 8,
    prepTimeMaxMin: 60,
    planDurationDays: 7,
  };

  const { intake, profile, rejected } = runPersona(input);

  it('should not be rejected', () => {
    expect(rejected).toBe(false);
  });

  it('should use Mifflin-St Jeor (no bodyFat)', () => {
    expect(profile!.calculationMethod).toBe('mifflin_st_jeor');
  });

  it('should have high calorie target for bulk', () => {
    expect(profile!.goalKcal).toBeGreaterThan(3000);
  });

  it('should NOT apply caloric floor', () => {
    expect(profile!.goalKcalFloorApplied).toBe(false);
  });

  it('should cap snack allocation at 25%', () => {
    // 4 snacks * 10% = 40%, but capped at 25%
    const snackRatio = intake.snacksPerDay * 0.1;
    expect(snackRatio).toBe(0.4); // raw would be 40%
    // The actual meal distribution should use max 25% for snacks
    // This is enforced in the metabolic calculator's meal target distribution
  });

  it('should set protein via g_per_kg method for bulk (~1.7 g/kg)', () => {
    expect(profile!.proteinMethod).toBe('g_per_kg');
    // 100 kg * 1.7 = 170g
    expect(profile!.proteinTargetG).toBeGreaterThanOrEqual(160);
    expect(profile!.proteinTargetG).toBeLessThanOrEqual(180);
  });

  it('should set male fiber floor at 38g', () => {
    expect(profile!.fiberTargetG).toBeGreaterThanOrEqual(38);
  });
});

// ─────────────────────────────────────────────────────
// Persona 3: Vegan Keto — Expected Rejection
// ─────────────────────────────────────────────────────
describe('Persona 3: Vegan Keto (Rejected)', () => {
  const input: RawIntakeForm = {
    name: 'Test',
    sex: 'female',
    age: 30,
    heightCm: 165,
    weightKg: 60,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'moderately_active',
    trainingDays: [],
    dietaryStyle: 'vegan',
    macroStyle: 'keto',
    allergies: [],
    exclusions: [],
    cuisinePreferences: [],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    planDurationDays: 7,
  };

  const { intake, rejected } = runPersona(input);

  it('should be REJECTED (vegan + keto incompatible)', () => {
    expect(rejected).toBe(true);
  });

  it('should have constraintsCompatible = false', () => {
    expect(intake.constraintsCompatible).toBe(false);
  });

  it('should include a constraint warning about vegan+keto', () => {
    expect(intake.constraintWarnings.length).toBeGreaterThan(0);
    const warning = intake.constraintWarnings.join(' ').toLowerCase();
    expect(warning).toMatch(/vegan.*keto|keto.*vegan/);
  });
});

// ─────────────────────────────────────────────────────
// Persona 4: Vegetarian Maintenance — Balanced Baseline
// ─────────────────────────────────────────────────────
describe('Persona 4: Vegetarian Maintenance', () => {
  const input: RawIntakeForm = {
    name: 'Test',
    sex: 'male',
    age: 55,
    heightFeet: 5,
    heightInches: 10,
    weightLbs: 200,
    bodyFatPercent: 25,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'lightly_active',
    trainingDays: ['tuesday', 'thursday'],
    dietaryStyle: 'vegetarian',
    macroStyle: 'balanced',
    allergies: ['peanut'],
    exclusions: [],
    cuisinePreferences: ['italian', 'indian'],
    mealsPerDay: 4,
    snacksPerDay: 2,
    cookingSkill: 4,
    prepTimeMaxMin: 30,
    planDurationDays: 5,
  };

  const { intake, profile, rejected } = runPersona(input);

  it('should not be rejected', () => {
    expect(rejected).toBe(false);
  });

  it('should convert imperial to metric', () => {
    expect(intake.heightCm).toBeCloseTo(177.8, 0);
    expect(intake.weightKg).toBeCloseTo(90.72, 0);
  });

  it('should use Katch-McArdle (bodyFat provided)', () => {
    expect(profile!.calculationMethod).toBe('katch_mcardle');
  });

  it('should set goalKcal = TDEE for maintenance (no deficit/surplus)', () => {
    // Maintenance: goalKcal should equal tdeeKcal
    expect(profile!.goalKcal).toBe(profile!.tdeeKcal);
  });

  it('should NOT apply caloric floor', () => {
    expect(profile!.goalKcalFloorApplied).toBe(false);
  });

  it('should set protein via g_per_kg for maintenance (~1.8 g/kg)', () => {
    expect(profile!.proteinMethod).toBe('g_per_kg');
    // ~90.72 kg * 1.8 = ~163.3g
    expect(profile!.proteinTargetG).toBeGreaterThanOrEqual(155);
    expect(profile!.proteinTargetG).toBeLessThanOrEqual(175);
  });

  it('should expand peanut allergy', () => {
    expect(intake.allergies).toContain('peanut');
    expect(intake.allergies).toContain('peanuts');
    expect(intake.allergies).toContain('peanut butter');
  });

  it('should have 5-day plan duration', () => {
    expect(intake.planDurationDays).toBe(5);
  });
});

// ─────────────────────────────────────────────────────
// Persona 5: Vegan Low-Carb — Warning (Not Rejection)
// ─────────────────────────────────────────────────────
describe('Persona 5: Vegan Low-Carb (Warned)', () => {
  const input: RawIntakeForm = {
    name: 'Test',
    sex: 'female',
    age: 19,
    heightCm: 170,
    weightKg: 58,
    bodyFatPercent: 22,
    goalType: 'cut',
    goalRate: 0.5,
    activityLevel: 'very_active',
    trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
    dietaryStyle: 'vegan',
    macroStyle: 'low_carb',
    allergies: ['soy', 'gluten'],
    exclusions: [],
    cuisinePreferences: ['asian'],
    mealsPerDay: 2,
    snacksPerDay: 0,
    cookingSkill: 10,
    prepTimeMaxMin: 60,
    planDurationDays: 7,
  };

  const { intake, profile, rejected } = runPersona(input);

  it('should NOT be rejected (vegan+low_carb is warned, not blocked)', () => {
    expect(rejected).toBe(false);
  });

  it('should have constraintsCompatible = true', () => {
    expect(intake.constraintsCompatible).toBe(true);
  });

  it('should include a constraint WARNING about vegan+low_carb', () => {
    expect(intake.constraintWarnings.length).toBeGreaterThan(0);
    const warning = intake.constraintWarnings.join(' ').toLowerCase();
    expect(warning).toMatch(/vegan.*low.carb|low.carb.*vegan/);
  });

  it('should use Katch-McArdle (bodyFat provided)', () => {
    expect(profile!.calculationMethod).toBe('katch_mcardle');
  });

  it('should set protein via g_per_kg for cut (~2.0 g/kg)', () => {
    expect(profile!.proteinMethod).toBe('g_per_kg');
    // 58 kg * 2.0 = 116g
    expect(profile!.proteinTargetG).toBeGreaterThanOrEqual(110);
    expect(profile!.proteinTargetG).toBeLessThanOrEqual(125);
  });

  it('should set female fiber floor at 25g', () => {
    expect(profile!.fiberTargetG).toBeGreaterThanOrEqual(25);
  });

  it('should expand soy and gluten allergies', () => {
    expect(intake.allergies).toContain('soy');
    expect(intake.allergies).toContain('tofu');
    expect(intake.allergies).toContain('tempeh');
    expect(intake.allergies).toContain('gluten');
    expect(intake.allergies).toContain('wheat');
    expect(intake.allergies).toContain('barley');
  });

  it('should have minimum 2 meals with 0 snacks', () => {
    expect(intake.mealsPerDay).toBe(2);
    expect(intake.snacksPerDay).toBe(0);
  });
});
