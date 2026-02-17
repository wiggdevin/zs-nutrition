import { RawIntakeForm, ClientIntake, ClientIntakeSchema } from '../types/schemas';

/**
 * Cross-validate dietaryStyle against macroStyle for constraint compatibility.
 * Detects conflicting combinations before the pipeline proceeds, avoiding
 * wasted computation on plans that cannot satisfy both constraints.
 */
export function crossValidateConstraints(
  dietaryStyle: string,
  macroStyle: string
): { warnings: string[]; compatible: boolean } {
  const warnings: string[] = [];
  let compatible = true;

  if (dietaryStyle === 'vegan' && macroStyle === 'keto') {
    warnings.push(
      'Vegan diet has limited compatibility with keto macros due to carb content of plant proteins'
    );
    compatible = false;
  }

  if (dietaryStyle === 'vegan' && macroStyle === 'low_carb') {
    warnings.push('Vegan low-carb is challenging; consider pescatarian or increase carb allowance');
  }

  return { warnings, compatible };
}

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

    // Cross-validate dietary style against macro style
    const { warnings, compatible } = crossValidateConstraints(input.dietaryStyle, input.macroStyle);

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
      constraintWarnings: warnings,
      constraintsCompatible: compatible,
    };

    // Validate output against schema
    return ClientIntakeSchema.parse(result);
  }
}
