import { z } from 'zod';

/**
 * Email validation schema using Zod
 * Validates standard email format: user@domain.tld
 */
export const emailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Please enter a valid email address');

/**
 * Validate an email address
 * @param email - The email string to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const result = emailSchema.safeParse(email);

  if (result.success) {
    return { isValid: true };
  }

  // Return the first error message
  const error = result.error.errors[0]?.message || 'Invalid email format';
  return { isValid: false, error };
}

/**
 * Meals per day validation schema
 * Must be between 2 and 6 meals per day
 */
export const mealsPerDaySchema = z
  .number()
  .int('Meals per day must be a whole number')
  .min(2, 'Meals per day must be at least 2')
  .max(6, 'Meals per day cannot exceed 6');

/**
 * Snacks per day validation schema
 * Must be between 0 and 4 snacks per day
 */
export const snacksPerDaySchema = z
  .number()
  .int('Snacks per day must be a whole number')
  .min(0, 'Snacks per day cannot be negative')
  .max(4, 'Snacks per day cannot exceed 4');

/**
 * Validate meals per day
 * @param mealsPerDay - The number of meals per day to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateMealsPerDay(mealsPerDay: number): { isValid: boolean; error?: string } {
  const result = mealsPerDaySchema.safeParse(mealsPerDay);

  if (result.success) {
    return { isValid: true };
  }

  const error = result.error.errors[0]?.message || 'Invalid meals per day';
  return { isValid: false, error };
}

/**
 * Validate snacks per day
 * @param snacksPerDay - The number of snacks per day to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateSnacksPerDay(snacksPerDay: number): { isValid: boolean; error?: string } {
  const result = snacksPerDaySchema.safeParse(snacksPerDay);

  if (result.success) {
    return { isValid: true };
  }

  const error = result.error.errors[0]?.message || 'Invalid snacks per day';
  return { isValid: false, error };
}

/**
 * Common validation schemas for the application
 */
export const authSchemas = {
  signUp: z.object({
    email: emailSchema,
  }),

  signIn: z.object({
    email: emailSchema,
  }),
};

/**
 * Cooking skill validation schema
 * Must be between 1 and 10
 */
export const cookingSkillSchema = z
  .number()
  .int('Cooking skill must be a whole number')
  .min(1, 'Cooking skill must be at least 1')
  .max(10, 'Cooking skill cannot exceed 10');

/**
 * Validate cooking skill
 * @param cookingSkill - The cooking skill level to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateCookingSkill(cookingSkill: number): { isValid: boolean; error?: string } {
  const result = cookingSkillSchema.safeParse(cookingSkill);

  if (result.success) {
    return { isValid: true };
  }

  const error = result.error.errors[0]?.message || 'Invalid cooking skill';
  return { isValid: false, error };
}

/**
 * Prep time max validation schema
 * Must be between 10 and 120 minutes
 */
export const prepTimeMaxSchema = z
  .number()
  .int('Prep time must be a whole number')
  .min(10, 'Prep time must be at least 10 minutes')
  .max(120, 'Prep time cannot exceed 120 minutes');

/**
 * Validate prep time max
 * @param prepTimeMax - The maximum prep time in minutes to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validatePrepTimeMax(prepTimeMax: number): { isValid: boolean; error?: string } {
  const result = prepTimeMaxSchema.safeParse(prepTimeMax);

  if (result.success) {
    return { isValid: true };
  }

  const error = result.error.errors[0]?.message || 'Invalid prep time';
  return { isValid: false, error };
}

/**
 * Age validation schema
 * Must be between 18 and 100
 */
export const ageSchema = z
  .number()
  .int('Age must be a whole number')
  .min(18, 'Age must be between 18 and 100')
  .max(100, 'Age must be between 18 and 100');

/**
 * Height (cm) validation schema
 * Must be between 90 and 250 cm
 */
export const heightCmSchema = z
  .number()
  .min(90, 'Height must be between 90 and 250 cm')
  .max(250, 'Height must be between 90 and 250 cm');

/**
 * Weight (kg) validation schema
 * Must be between 35 and 230 kg
 */
export const weightKgSchema = z
  .number()
  .min(35, 'Weight must be between 35 and 230 kg')
  .max(230, 'Weight must be between 35 and 230 kg');

/**
 * Body fat percentage validation schema
 * Must be between 3 and 60 percent (optional field)
 */
export const bodyFatPercentSchema = z
  .number()
  .min(3, 'Body fat must be between 3% and 60%')
  .max(60, 'Body fat must be between 3% and 60%')
  .nullable()
  .optional();

/**
 * Goal rate validation schema
 * Must be between 0 and 2 lbs per week
 */
export const goalRateSchema = z
  .number()
  .min(0, 'Goal rate must be between 0 and 2')
  .max(2, 'Goal rate must be between 0 and 2');

/**
 * Sex validation schema
 */
export const sexSchema = z.enum(['male', 'female'], {
  errorMap: () => ({ message: 'Sex must be male or female' }),
});

/**
 * Goal type validation schema
 */
export const goalTypeSchema = z.enum(['cut', 'maintain', 'bulk'], {
  errorMap: () => ({ message: 'Invalid goal type' }),
});

/**
 * Activity level validation schema
 */
export const activityLevelSchema = z.enum(
  ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
  {
    errorMap: () => ({ message: 'Invalid activity level' }),
  }
);

/**
 * Dietary style validation schema
 */
export const dietaryStyleSchema = z.enum(
  ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo'],
  {
    errorMap: () => ({ message: 'Invalid dietary style' }),
  }
);

/**
 * Macro style validation schema
 */
export const macroStyleSchema = z.enum(['balanced', 'high_protein', 'low_carb', 'keto'], {
  errorMap: () => ({ message: 'Invalid macro style' }),
});

/**
 * Name validation schema
 */
export const nameSchema = z.string().min(1, 'Name is required').trim();

/**
 * Training time validation schema
 */
export const trainingTimeSchema = z.enum(['morning', 'afternoon', 'evening']).nullable().optional();

/**
 * Validate age
 * @param age - The age to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateAge(age: number): { isValid: boolean; error?: string } {
  const result = ageSchema.safeParse(age);
  if (result.success) {
    return { isValid: true };
  }
  const error = result.error.errors[0]?.message || 'Invalid age';
  return { isValid: false, error };
}

/**
 * Validate height in cm
 * @param heightCm - The height in cm to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateHeightCm(heightCm: number): { isValid: boolean; error?: string } {
  const result = heightCmSchema.safeParse(heightCm);
  if (result.success) {
    return { isValid: true };
  }
  const error = result.error.errors[0]?.message || 'Invalid height';
  return { isValid: false, error };
}

/**
 * Validate weight in kg
 * @param weightKg - The weight in kg to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateWeightKg(weightKg: number): { isValid: boolean; error?: string } {
  const result = weightKgSchema.safeParse(weightKg);
  if (result.success) {
    return { isValid: true };
  }
  const error = result.error.errors[0]?.message || 'Invalid weight';
  return { isValid: false, error };
}

/**
 * Validate body fat percentage
 * @param bodyFatPercent - The body fat percentage to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateBodyFatPercent(bodyFatPercent: number | null): {
  isValid: boolean;
  error?: string;
} {
  if (bodyFatPercent === null || bodyFatPercent === undefined) {
    return { isValid: true }; // Optional field
  }
  const result = bodyFatPercentSchema.safeParse(bodyFatPercent);
  if (result.success) {
    return { isValid: true };
  }
  const error = result.error.errors[0]?.message || 'Invalid body fat percentage';
  return { isValid: false, error };
}

/**
 * Validate goal rate
 * @param goalRate - The goal rate to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateGoalRate(goalRate: number): { isValid: boolean; error?: string } {
  const result = goalRateSchema.safeParse(goalRate);
  if (result.success) {
    return { isValid: true };
  }
  const error = result.error.errors[0]?.message || 'Invalid goal rate';
  return { isValid: false, error };
}

/**
 * Comprehensive profile update validation schema
 * This schema validates all fields that can be updated via the settings API
 */
export const profileUpdateSchema = z
  .object({
    // Demographics
    name: nameSchema.optional(),
    sex: sexSchema.optional(),
    age: ageSchema.optional(),
    heightCm: heightCmSchema.optional(),
    weightKg: weightKgSchema.optional(),
    bodyFatPercent: bodyFatPercentSchema,

    // Goals
    goalType: goalTypeSchema.optional(),
    goalRate: goalRateSchema.optional(),

    // Activity
    activityLevel: activityLevelSchema.optional(),
    trainingDays: z.array(z.string()).optional(),
    trainingTime: trainingTimeSchema,

    // Dietary
    dietaryStyle: dietaryStyleSchema.optional(),
    allergies: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    cuisinePrefs: z.array(z.string()).optional(),

    // Meal structure
    macroStyle: macroStyleSchema.optional(),
    mealsPerDay: mealsPerDaySchema.optional(),
    snacksPerDay: snacksPerDaySchema.optional(),
    cookingSkill: cookingSkillSchema.optional(),
    prepTimeMax: prepTimeMaxSchema.optional(),
  })
  .strict();

/**
 * Profile validation schemas
 */
export const profileSchemas = {
  mealStructure: z.object({
    mealsPerDay: mealsPerDaySchema,
    snacksPerDay: snacksPerDaySchema,
  }),

  // Full profile schema for onboarding
  onboarding: z.object({
    name: nameSchema,
    sex: sexSchema,
    age: ageSchema,
    heightCm: heightCmSchema,
    weightKg: weightKgSchema,
    bodyFatPercent: bodyFatPercentSchema,
    goalType: goalTypeSchema,
    goalRate: goalRateSchema,
    activityLevel: activityLevelSchema,
    trainingDays: z.array(z.string()),
    trainingTime: trainingTimeSchema,
    dietaryStyle: dietaryStyleSchema,
    allergies: z.array(z.string()),
    exclusions: z.array(z.string()),
    cuisinePreferences: z.array(z.string()),
    mealsPerDay: mealsPerDaySchema,
    snacksPerDay: snacksPerDaySchema,
    cookingSkill: cookingSkillSchema,
    prepTimeMax: prepTimeMaxSchema,
    macroStyle: macroStyleSchema,
  }),
};
