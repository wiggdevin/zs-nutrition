import { RawIntakeForm, ClientIntake, ClientIntakeSchema } from '../types/schemas';

/**
 * Agent 1: Intake Normalizer
 * Transforms raw user input into clean, validated, metric-normalized data.
 * No LLM required — pure deterministic logic.
 */
export class IntakeNormalizer {
  normalize(input: RawIntakeForm): ClientIntake {
    // Convert height to cm
    let heightCm: number;
    if (input.heightCm) {
      heightCm = input.heightCm;
    } else if (input.heightFeet !== undefined && input.heightInches !== undefined) {
      const totalInches = input.heightFeet * 12 + input.heightInches;
      heightCm = Math.round(totalInches * 2.54 * 10) / 10;
    } else {
      throw new Error('Height must be provided in cm or ft/in');
    }

    // Convert weight to kg
    let weightKg: number;
    if (input.weightKg) {
      weightKg = input.weightKg;
    } else if (input.weightLbs) {
      weightKg = Math.round(input.weightLbs * 0.453592 * 10) / 10;
    } else {
      throw new Error('Weight must be provided in kg or lbs');
    }

    // Clean string arrays: lowercase, trim, dedupe
    const cleanArray = (arr: string[]): string[] => {
      const cleaned = arr.map((s) => s.toLowerCase().trim()).filter(Boolean);
      return [...new Set(cleaned)];
    };

    const result = {
      name: input.name.trim(),
      sex: input.sex,
      age: input.age,
      heightCm,
      weightKg,
      bodyFatPercent: input.bodyFatPercent,
      goalType: input.goalType,
      goalRate: input.goalRate,
      activityLevel: input.activityLevel,
      trainingDays: input.trainingDays,
      trainingTime: input.trainingTime,
      dietaryStyle: input.dietaryStyle,
      allergies: cleanArray(input.allergies),
      exclusions: cleanArray(input.exclusions),
      cuisinePreferences: cleanArray(input.cuisinePreferences),
      mealsPerDay: input.mealsPerDay,
      snacksPerDay: input.snacksPerDay,
      cookingSkill: input.cookingSkill,
      prepTimeMaxMin: input.prepTimeMaxMin,
      macroStyle: input.macroStyle,
      planDurationDays: input.planDurationDays ?? 7,
    };

    // Validate output against schema
    return ClientIntakeSchema.parse(result);
  }
}
