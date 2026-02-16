import { describe, it, expect } from 'vitest';
import { IntakeNormalizer } from './intake-normalizer';
import { RawIntakeForm } from '../types/schemas';

describe('IntakeNormalizer', () => {
  const normalizer = new IntakeNormalizer();

  // Helper to create a base raw intake form
  const createBaseRawIntake = (overrides: Partial<RawIntakeForm> = {}): RawIntakeForm => ({
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

  describe('Height conversion', () => {
    it('preserves metric height when provided in cm', () => {
      const input = createBaseRawIntake({ heightCm: 180 });
      const result = normalizer.normalize(input);

      expect(result.heightCm).toBe(180);
    });

    it('converts imperial height to metric (feet and inches)', () => {
      const input = createBaseRawIntake({
        heightCm: undefined,
        heightFeet: 6,
        heightInches: 0,
      });

      const result = normalizer.normalize(input);

      // 6 feet = 72 inches = 72 * 2.54 = 182.88 cm, rounded to 182.9
      expect(result.heightCm).toBe(182.9);
    });

    it('converts imperial height correctly for 5 feet 9 inches', () => {
      const input = createBaseRawIntake({
        heightCm: undefined,
        heightFeet: 5,
        heightInches: 9,
      });

      const result = normalizer.normalize(input);

      // 5'9" = 69 inches = 69 * 2.54 = 175.26 cm, rounded to 175.3
      expect(result.heightCm).toBe(175.3);
    });

    it('handles partial inches correctly', () => {
      const input = createBaseRawIntake({
        heightCm: undefined,
        heightFeet: 5,
        heightInches: 6,
      });

      const result = normalizer.normalize(input);

      // 5'6" = 66 inches = 66 * 2.54 = 167.64 cm, rounded to 167.6
      expect(result.heightCm).toBe(167.6);
    });

    it('throws error when no height provided', () => {
      const input = createBaseRawIntake({
        heightCm: undefined,
        heightFeet: undefined,
        heightInches: undefined,
      });

      expect(() => normalizer.normalize(input)).toThrow('Height must be provided in cm or ft/in');
    });

    it('throws error when only feet provided without inches', () => {
      const input = createBaseRawIntake({
        heightCm: undefined,
        heightFeet: 6,
        heightInches: undefined,
      });

      expect(() => normalizer.normalize(input)).toThrow('Height must be provided in cm or ft/in');
    });
  });

  describe('Weight conversion', () => {
    it('preserves metric weight when provided in kg', () => {
      const input = createBaseRawIntake({ weightKg: 80 });
      const result = normalizer.normalize(input);

      expect(result.weightKg).toBe(80);
    });

    it('converts imperial weight to metric (lbs to kg)', () => {
      const input = createBaseRawIntake({
        weightKg: undefined,
        weightLbs: 176.37,
      });

      const result = normalizer.normalize(input);

      // 176.37 lbs * 0.453592 = 80.0 kg
      expect(result.weightKg).toBe(80);
    });

    it('converts weight correctly for 150 lbs', () => {
      const input = createBaseRawIntake({
        weightKg: undefined,
        weightLbs: 150,
      });

      const result = normalizer.normalize(input);

      // 150 * 0.453592 = 68.0388, rounded to 68.0
      expect(result.weightKg).toBe(68);
    });

    it('converts weight correctly for 200 lbs', () => {
      const input = createBaseRawIntake({
        weightKg: undefined,
        weightLbs: 200,
      });

      const result = normalizer.normalize(input);

      // 200 * 0.453592 = 90.7184, rounded to 90.7
      expect(result.weightKg).toBe(90.7);
    });

    it('throws error when no weight provided', () => {
      const input = createBaseRawIntake({
        weightKg: undefined,
        weightLbs: undefined,
      });

      expect(() => normalizer.normalize(input)).toThrow('Weight must be provided in kg or lbs');
    });
  });

  describe('Allergy deduplication and normalization', () => {
    it('lowercases and trims allergies', () => {
      const input = createBaseRawIntake({
        allergies: ['Peanuts', 'SHELLFISH', ' Tree Nuts '],
      });

      const result = normalizer.normalize(input);

      expect(result.allergies).toEqual(['peanuts', 'shellfish', 'tree nuts']);
    });

    it('removes duplicate allergies', () => {
      const input = createBaseRawIntake({
        allergies: ['peanuts', 'Peanuts', 'PEANUTS', 'shellfish', 'Shellfish'],
      });

      const result = normalizer.normalize(input);

      expect(result.allergies).toEqual(['peanuts', 'shellfish']);
    });

    it('filters out empty strings', () => {
      const input = createBaseRawIntake({
        allergies: ['peanuts', '', '  ', 'shellfish'],
      });

      const result = normalizer.normalize(input);

      expect(result.allergies).toEqual(['peanuts', 'shellfish']);
    });

    it('handles empty allergy array', () => {
      const input = createBaseRawIntake({
        allergies: [],
      });

      const result = normalizer.normalize(input);

      expect(result.allergies).toEqual([]);
    });
  });

  describe('Exclusions deduplication and normalization', () => {
    it('lowercases and trims exclusions', () => {
      const input = createBaseRawIntake({
        exclusions: ['Beef', 'PORK', ' Lamb '],
      });

      const result = normalizer.normalize(input);

      expect(result.exclusions).toEqual(['beef', 'pork', 'lamb']);
    });

    it('removes duplicate exclusions', () => {
      const input = createBaseRawIntake({
        exclusions: ['beef', 'Beef', 'BEEF', 'pork'],
      });

      const result = normalizer.normalize(input);

      expect(result.exclusions).toEqual(['beef', 'pork']);
    });

    it('filters out empty strings', () => {
      const input = createBaseRawIntake({
        exclusions: ['beef', '', '  ', 'pork'],
      });

      const result = normalizer.normalize(input);

      expect(result.exclusions).toEqual(['beef', 'pork']);
    });
  });

  describe('Cuisine preferences normalization', () => {
    it('lowercases and trims cuisine preferences', () => {
      const input = createBaseRawIntake({
        cuisinePreferences: ['Italian', 'JAPANESE', ' Mexican '],
      });

      const result = normalizer.normalize(input);

      expect(result.cuisinePreferences).toEqual(['italian', 'japanese', 'mexican']);
    });

    it('removes duplicate cuisines', () => {
      const input = createBaseRawIntake({
        cuisinePreferences: ['italian', 'Italian', 'ITALIAN', 'japanese'],
      });

      const result = normalizer.normalize(input);

      expect(result.cuisinePreferences).toEqual(['italian', 'japanese']);
    });
  });

  describe('Name trimming', () => {
    it('trims whitespace from name', () => {
      const input = createBaseRawIntake({
        name: '  John Doe  ',
      });

      const result = normalizer.normalize(input);

      expect(result.name).toBe('John Doe');
    });

    it('preserves name with spaces', () => {
      const input = createBaseRawIntake({
        name: 'Mary Jane Watson',
      });

      const result = normalizer.normalize(input);

      expect(result.name).toBe('Mary Jane Watson');
    });
  });

  describe('Dietary style normalization', () => {
    it('preserves valid dietary styles', () => {
      const styles: Array<'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'> =
        ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo'];

      styles.forEach((style) => {
        const input = createBaseRawIntake({ dietaryStyle: style });
        const result = normalizer.normalize(input);

        expect(result.dietaryStyle).toBe(style);
      });
    });
  });

  describe('Full integration', () => {
    it('normalizes complete imperial input', () => {
      const input = createBaseRawIntake({
        name: '  Jane Smith  ',
        heightCm: undefined,
        heightFeet: 5,
        heightInches: 6,
        weightKg: undefined,
        weightLbs: 140,
        allergies: ['Peanuts', 'SHELLFISH', 'peanuts'],
        exclusions: ['Beef', 'PORK'],
        cuisinePreferences: ['Italian', 'japanese', 'ITALIAN'],
      });

      const result = normalizer.normalize(input);

      expect(result.name).toBe('Jane Smith');
      expect(result.heightCm).toBe(167.6); // 5'6"
      expect(result.weightKg).toBe(63.5); // 140 lbs
      expect(result.allergies).toEqual(['peanuts', 'shellfish']);
      expect(result.exclusions).toEqual(['beef', 'pork']);
      expect(result.cuisinePreferences).toEqual(['italian', 'japanese']);
    });

    it('normalizes complete metric input', () => {
      const input = createBaseRawIntake({
        name: 'John Doe',
        heightCm: 180,
        weightKg: 80,
        allergies: [],
        exclusions: [],
        cuisinePreferences: ['mexican', 'thai'],
      });

      const result = normalizer.normalize(input);

      expect(result.name).toBe('John Doe');
      expect(result.heightCm).toBe(180);
      expect(result.weightKg).toBe(80);
      expect(result.allergies).toEqual([]);
      expect(result.exclusions).toEqual([]);
      expect(result.cuisinePreferences).toEqual(['mexican', 'thai']);
    });

    it('validates output against ClientIntake schema', () => {
      const input = createBaseRawIntake();

      // Should not throw - schema validation happens in normalize()
      const result = normalizer.normalize(input);

      expect(result.name).toBeDefined();
      expect(result.sex).toBeDefined();
      expect(result.age).toBeDefined();
      expect(result.heightCm).toBeDefined();
      expect(result.weightKg).toBeDefined();
      expect(result.goalType).toBeDefined();
      expect(result.activityLevel).toBeDefined();
      expect(result.dietaryStyle).toBeDefined();
      expect(result.mealsPerDay).toBeDefined();
      expect(result.macroStyle).toBeDefined();
    });

    it('sets default planDurationDays to 7 if not provided', () => {
      const input = createBaseRawIntake({
        planDurationDays: undefined,
      });

      const result = normalizer.normalize(input);

      expect(result.planDurationDays).toBe(7);
    });

    it('preserves custom planDurationDays', () => {
      const input = createBaseRawIntake({
        planDurationDays: 5,
      });

      const result = normalizer.normalize(input);

      expect(result.planDurationDays).toBe(5);
    });
  });

  describe('Invalid input rejection', () => {
    it('rejects invalid sex through schema validation', () => {
      const input = createBaseRawIntake({
        sex: 'invalid' as any,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects invalid goal type through schema validation', () => {
      const input = createBaseRawIntake({
        goalType: 'invalid' as any,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects invalid activity level through schema validation', () => {
      const input = createBaseRawIntake({
        activityLevel: 'invalid' as any,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects invalid dietary style through schema validation', () => {
      const input = createBaseRawIntake({
        dietaryStyle: 'invalid' as any,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects age below minimum (18)', () => {
      const input = createBaseRawIntake({
        age: 17,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects age above maximum (100)', () => {
      const input = createBaseRawIntake({
        age: 101,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects mealsPerDay below minimum (2)', () => {
      const input = createBaseRawIntake({
        mealsPerDay: 1,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });

    it('rejects mealsPerDay above maximum (6)', () => {
      const input = createBaseRawIntake({
        mealsPerDay: 7,
      });

      expect(() => normalizer.normalize(input)).toThrow();
    });
  });
});
