import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Dev-only endpoint to test tRPC Zod validation error formatting.
 * Tests the same Zod schemas used by tRPC routers and returns the formatted errors.
 * This validates that server-side validation works even if client validation is bypassed.
 */

// Same schema as user.updateProfile
const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  age: z.number().int('Age must be a whole number').min(18, 'Must be at least 18 years old').max(100, 'Age must be 100 or less'),
  heightCm: z.number().min(100, 'Height must be at least 100 cm').max(250, 'Height must be 250 cm or less'),
  weightKg: z.number().min(30, 'Weight must be at least 30 kg').max(300, 'Weight must be 300 kg or less'),
  bodyFatPercent: z.number().min(3, 'Body fat must be at least 3%').max(60, 'Body fat must be 60% or less').optional(),
  goalType: z.enum(['cut', 'maintain', 'bulk'], { errorMap: () => ({ message: 'Goal type must be cut, maintain, or bulk' }) }),
  goalRate: z.number().min(0, 'Goal rate must be non-negative').max(2, 'Goal rate must be 2 or less'),
  activityLevel: z.enum([
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active',
  ], { errorMap: () => ({ message: 'Invalid activity level' }) }),
  dietaryStyle: z.enum([
    'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo',
  ], { errorMap: () => ({ message: 'Invalid dietary style' }) }),
  mealsPerDay: z.number().int().min(2, 'Meals per day must be at least 2').max(6, 'Meals per day must be 6 or less'),
  snacksPerDay: z.number().int().min(0, 'Snacks per day cannot be negative').max(4, 'Snacks per day must be 4 or less'),
  cookingSkill: z.number().int().min(1, 'Cooking skill must be at least 1').max(10, 'Cooking skill must be 10 or less'),
  prepTimeMax: z.number().int().min(10, 'Prep time must be at least 10 minutes').max(120, 'Prep time must be 120 minutes or less'),
  macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto'], { errorMap: () => ({ message: 'Invalid macro style' }) }),
})

// Same schema as user.completeOnboarding
const onboardingSchema = z.object({
  name: z.string().min(1),
  sex: z.enum(['male', 'female']),
  age: z.number().min(18).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  bodyFatPercent: z.number().min(3).max(60).optional(),
  goalType: z.enum(['cut', 'maintain', 'bulk']),
  goalRate: z.number().min(0).max(2),
  activityLevel: z.enum([
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active',
  ]),
  trainingDays: z.array(z.string()),
  dietaryStyle: z.enum([
    'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo',
  ]),
  allergies: z.array(z.string()),
  exclusions: z.array(z.string()),
  cuisinePreferences: z.array(z.string()),
  mealsPerDay: z.number().min(2).max(6),
  snacksPerDay: z.number().min(0).max(4),
  cookingSkill: z.number().min(1).max(10),
  prepTimeMax: z.number().min(10).max(120),
  macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto']),
})

// Same schema as tracking.logMeal
const logMealSchema = z.object({
  mealName: z.string().min(1, 'Meal name is required').max(200, 'Meal name must be 200 characters or less'),
  calories: z.number().min(0, 'Calories cannot be negative').max(10000, 'Calories must be 10000 or less'),
  protein: z.number().min(0, 'Protein cannot be negative').max(1000, 'Protein must be 1000g or less'),
  carbs: z.number().min(0, 'Carbs cannot be negative').max(1000, 'Carbs must be 1000g or less'),
  fat: z.number().min(0, 'Fat cannot be negative').max(1000, 'Fat must be 1000g or less'),
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack'], { errorMap: () => ({ message: 'Meal slot must be breakfast, lunch, dinner, or snack' }) }).optional(),
  date: z.string().optional(),
})

// Same schema as meal.quickAdd
const quickAddSchema = z.object({
  calories: z.number().int().min(1).max(10000),
  protein: z.number().min(0).max(1000).optional(),
  carbs: z.number().min(0).max(1000).optional(),
  fat: z.number().min(0).max(1000).optional(),
  mealName: z.string().max(100).optional(),
  mealSlot: z.string().optional(),
})

function formatZodError(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'input',
    message: issue.message,
  }))
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 })
  }

  const results: {
    test: string
    schema: string
    input: Record<string, unknown>
    valid: boolean
    errors?: { field: string; message: string }[]
  }[] = []

  // ===== Test Group 1: user.updateProfile with invalid data =====

  // Test 1a: updateProfile with empty name
  const profileInvalid1 = {
    name: '', // INVALID: empty string
    age: 25,
    heightCm: 175,
    weightKg: 70,
    goalType: 'maintain',
    goalRate: 1,
    activityLevel: 'moderately_active',
    dietaryStyle: 'omnivore',
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMax: 30,
    macroStyle: 'balanced',
  }
  const profileResult1 = updateProfileSchema.safeParse(profileInvalid1)
  results.push({
    test: 'updateProfile with empty name (should fail)',
    schema: 'user.updateProfile',
    input: { name: '' },
    valid: profileResult1.success,
    errors: !profileResult1.success ? formatZodError(profileResult1.error) : undefined,
  })

  // Test 1b: updateProfile with age=5 (below min 18)
  const profileInvalid2 = { ...profileInvalid1, name: 'Test', age: 5 }
  const profileResult2 = updateProfileSchema.safeParse(profileInvalid2)
  results.push({
    test: 'updateProfile with age=5 (below min 18, should fail)',
    schema: 'user.updateProfile',
    input: { age: 5 },
    valid: profileResult2.success,
    errors: !profileResult2.success ? formatZodError(profileResult2.error) : undefined,
  })

  // Test 1c: updateProfile with invalid goalType
  const profileInvalid3 = { ...profileInvalid1, name: 'Test', goalType: 'invalid_goal' }
  const profileResult3 = updateProfileSchema.safeParse(profileInvalid3)
  results.push({
    test: 'updateProfile with invalid goalType (should fail)',
    schema: 'user.updateProfile',
    input: { goalType: 'invalid_goal' },
    valid: profileResult3.success,
    errors: !profileResult3.success ? formatZodError(profileResult3.error) : undefined,
  })

  // Test 1d: updateProfile with weightKg=0 (below min 30)
  const profileInvalid4 = { ...profileInvalid1, name: 'Test', weightKg: 0 }
  const profileResult4 = updateProfileSchema.safeParse(profileInvalid4)
  results.push({
    test: 'updateProfile with weightKg=0 (below min 30, should fail)',
    schema: 'user.updateProfile',
    input: { weightKg: 0 },
    valid: profileResult4.success,
    errors: !profileResult4.success ? formatZodError(profileResult4.error) : undefined,
  })

  // Test 1e: Valid updateProfile (should pass)
  const profileValid = { ...profileInvalid1, name: 'Test User' }
  const profileResultValid = updateProfileSchema.safeParse(profileValid)
  results.push({
    test: 'updateProfile with valid data (should pass)',
    schema: 'user.updateProfile',
    input: { name: 'Test User', age: 25, weightKg: 70 },
    valid: profileResultValid.success,
  })

  // ===== Test Group 2: tracking.logMeal with invalid data =====

  // Test 2a: logMeal with negative calories
  const mealInvalid1 = {
    mealName: 'Test Meal',
    calories: -100, // INVALID: negative
    protein: 20,
    carbs: 30,
    fat: 10,
  }
  const mealResult1 = logMealSchema.safeParse(mealInvalid1)
  results.push({
    test: 'logMeal with negative calories (-100, should fail)',
    schema: 'tracking.logMeal',
    input: { calories: -100 },
    valid: mealResult1.success,
    errors: !mealResult1.success ? formatZodError(mealResult1.error) : undefined,
  })

  // Test 2b: logMeal with negative protein
  const mealInvalid2 = { ...mealInvalid1, calories: 500, protein: -50 }
  const mealResult2 = logMealSchema.safeParse(mealInvalid2)
  results.push({
    test: 'logMeal with negative protein (-50, should fail)',
    schema: 'tracking.logMeal',
    input: { protein: -50 },
    valid: mealResult2.success,
    errors: !mealResult2.success ? formatZodError(mealResult2.error) : undefined,
  })

  // Test 2c: logMeal with empty meal name
  const mealInvalid3 = { ...mealInvalid1, calories: 500, mealName: '' }
  const mealResult3 = logMealSchema.safeParse(mealInvalid3)
  results.push({
    test: 'logMeal with empty mealName (should fail)',
    schema: 'tracking.logMeal',
    input: { mealName: '' },
    valid: mealResult3.success,
    errors: !mealResult3.success ? formatZodError(mealResult3.error) : undefined,
  })

  // Test 2d: logMeal with calories > 10000
  const mealInvalid4 = { ...mealInvalid1, calories: 99999, mealName: 'Test' }
  const mealResult4 = logMealSchema.safeParse(mealInvalid4)
  results.push({
    test: 'logMeal with calories=99999 (above max 10000, should fail)',
    schema: 'tracking.logMeal',
    input: { calories: 99999 },
    valid: mealResult4.success,
    errors: !mealResult4.success ? formatZodError(mealResult4.error) : undefined,
  })

  // Test 2e: Valid logMeal (should pass)
  const mealValid = {
    mealName: 'Grilled Chicken Breast',
    calories: 350,
    protein: 40,
    carbs: 5,
    fat: 15,
    mealSlot: 'lunch',
  }
  const mealResultValid = logMealSchema.safeParse(mealValid)
  results.push({
    test: 'logMeal with valid data (should pass)',
    schema: 'tracking.logMeal',
    input: { mealName: 'Grilled Chicken Breast', calories: 350 },
    valid: mealResultValid.success,
  })

  // ===== Test Group 3: quickAdd with invalid data =====

  // Test 3a: quickAdd with negative calories
  const quickAddInvalid = { calories: -100, protein: 20 }
  const quickAddResult1 = quickAddSchema.safeParse(quickAddInvalid)
  results.push({
    test: 'quickAdd with negative calories (-100, should fail)',
    schema: 'meal.quickAdd',
    input: { calories: -100 },
    valid: quickAddResult1.success,
    errors: !quickAddResult1.success ? formatZodError(quickAddResult1.error) : undefined,
  })

  // Test 3b: quickAdd with calories=0 (below min 1)
  const quickAddResult2 = quickAddSchema.safeParse({ calories: 0 })
  results.push({
    test: 'quickAdd with calories=0 (below min 1, should fail)',
    schema: 'meal.quickAdd',
    input: { calories: 0 },
    valid: quickAddResult2.success,
    errors: !quickAddResult2.success ? formatZodError(quickAddResult2.error) : undefined,
  })

  // ===== Summary =====

  const invalidTests = results.filter((r) => !r.valid)
  const validTests = results.filter((r) => r.valid)

  const allInvalidsHaveErrors = invalidTests.every(
    (r) => r.errors && r.errors.length > 0 && r.errors.every((e) => e.message.length > 0)
  )

  const allErrorsReferenceFields = invalidTests.every(
    (r) => r.errors && r.errors.every((e) => e.field !== 'input' && e.field.length > 0)
  )

  const allErrorsAreDescriptive = invalidTests.every(
    (r) => r.errors && r.errors.every((e) => e.message.length > 5) // at least a meaningful sentence
  )

  return NextResponse.json({
    summary: {
      total: results.length,
      valid: validTests.length,
      invalid: invalidTests.length,
      allInvalidsHaveFieldErrors: allInvalidsHaveErrors,
      allErrorsReferenceFields: allErrorsReferenceFields,
      allErrorsAreDescriptive: allErrorsAreDescriptive,
      status: allInvalidsHaveErrors && allErrorsReferenceFields && allErrorsAreDescriptive ? 'ALL_PASSING' : 'SOME_FAILING',
    },
    results,
  })
}
