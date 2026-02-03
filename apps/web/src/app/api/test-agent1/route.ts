import { NextResponse } from 'next/server';
import { IntakeNormalizer } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #110: Agent 1 cleans and deduplicates string arrays
 * Tests that IntakeNormalizer lowercases, trims, and deduplicates allergies and exclusions.
 */
export async function GET() {
  const normalizer = new IntakeNormalizer();

  const results: Array<{
    testCase: number;
    description: string;
    input: { allergies: string[]; exclusions: string[] };
    output: { allergies: string[]; exclusions: string[] };
    checks: Record<string, { expected: any; actual: any; pass: boolean }>;
    allPassing: boolean;
  }> = [];

  // Test Case 1: Duplicates with different casing and whitespace in allergies
  try {
    const input = {
      name: 'TestUser_Agent1',
      sex: 'male' as const,
      age: 30,
      heightCm: 180,
      weightKg: 80,
      goalType: 'cut' as const,
      goalRate: 1,
      activityLevel: 'moderately_active' as const,
      trainingDays: ['monday', 'wednesday', 'friday'] as Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
      trainingTime: 'morning' as const,
      dietaryStyle: 'omnivore' as const,
      allergies: ['Peanuts', ' peanuts ', 'DAIRY', 'dairy'],
      exclusions: ['Broccoli', ' broccoli ', 'TOFU', 'tofu'],
      cuisinePreferences: ['Italian', ' italian '],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 7,
      prepTimeMaxMin: 45,
      macroStyle: 'balanced' as const,
      planDurationDays: 7,
    };

    const result = normalizer.normalize(input);

    const allergiesCheck = {
      expected: ['peanuts', 'dairy'],
      actual: result.allergies,
      pass:
        result.allergies.length === 2 &&
        result.allergies.includes('peanuts') &&
        result.allergies.includes('dairy'),
    };

    const exclusionsCheck = {
      expected: ['broccoli', 'tofu'],
      actual: result.exclusions,
      pass:
        result.exclusions.length === 2 &&
        result.exclusions.includes('broccoli') &&
        result.exclusions.includes('tofu'),
    };

    const cuisineCheck = {
      expected: ['italian'],
      actual: result.cuisinePreferences,
      pass:
        result.cuisinePreferences.length === 1 &&
        result.cuisinePreferences.includes('italian'),
    };

    const checks = { allergies: allergiesCheck, exclusions: exclusionsCheck, cuisinePreferences: cuisineCheck };
    const allPassing = Object.values(checks).every((c) => c.pass);

    results.push({
      testCase: 1,
      description: 'Duplicates with mixed casing and whitespace',
      input: { allergies: input.allergies, exclusions: input.exclusions },
      output: { allergies: result.allergies, exclusions: result.exclusions },
      checks,
      allPassing,
    });
  } catch (error: any) {
    results.push({
      testCase: 1,
      description: 'Duplicates with mixed casing and whitespace',
      input: { allergies: ['Peanuts', ' peanuts ', 'DAIRY', 'dairy'], exclusions: ['Broccoli', ' broccoli ', 'TOFU', 'tofu'] },
      output: { allergies: [], exclusions: [] },
      checks: { error: { expected: 'no error', actual: error.message, pass: false } },
      allPassing: false,
    });
  }

  // Test Case 2: Empty arrays stay empty
  try {
    const input2 = {
      name: 'TestUser_Agent1_Empty',
      sex: 'female' as const,
      age: 25,
      heightCm: 165,
      weightKg: 60,
      goalType: 'maintain' as const,
      goalRate: 0,
      activityLevel: 'lightly_active' as const,
      trainingDays: ['tuesday', 'thursday'] as Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
      trainingTime: 'evening' as const,
      dietaryStyle: 'vegetarian' as const,
      allergies: [],
      exclusions: [],
      cuisinePreferences: [],
      mealsPerDay: 3,
      snacksPerDay: 0,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'high_protein' as const,
      planDurationDays: 7,
    };

    const result2 = normalizer.normalize(input2);

    const checks = {
      emptyAllergies: { expected: [], actual: result2.allergies, pass: result2.allergies.length === 0 },
      emptyExclusions: { expected: [], actual: result2.exclusions, pass: result2.exclusions.length === 0 },
    };

    results.push({
      testCase: 2,
      description: 'Empty arrays remain empty',
      input: { allergies: [], exclusions: [] },
      output: { allergies: result2.allergies, exclusions: result2.exclusions },
      checks,
      allPassing: Object.values(checks).every((c) => c.pass),
    });
  } catch (error: any) {
    results.push({
      testCase: 2,
      description: 'Empty arrays remain empty',
      input: { allergies: [], exclusions: [] },
      output: { allergies: [], exclusions: [] },
      checks: { error: { expected: 'no error', actual: error.message, pass: false } },
      allPassing: false,
    });
  }

  // Test Case 3: All whitespace-only items get filtered out
  try {
    const input3 = {
      name: 'TestUser_Agent1_Whitespace',
      sex: 'male' as const,
      age: 28,
      heightCm: 175,
      weightKg: 75,
      goalType: 'bulk' as const,
      goalRate: 1,
      activityLevel: 'very_active' as const,
      trainingDays: ['monday', 'wednesday', 'friday'] as Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
      trainingTime: 'afternoon' as const,
      dietaryStyle: 'omnivore' as const,
      allergies: ['  ', 'eggs', '  eggs  ', 'EGGS'],
      exclusions: ['  ', 'LIVER', ' liver '],
      cuisinePreferences: ['mexican'],
      mealsPerDay: 4,
      snacksPerDay: 1,
      cookingSkill: 6,
      prepTimeMaxMin: 30,
      macroStyle: 'balanced' as const,
      planDurationDays: 7,
    };

    const result3 = normalizer.normalize(input3);

    const checks = {
      allergiesFiltered: {
        expected: ['eggs'],
        actual: result3.allergies,
        pass: result3.allergies.length === 1 && result3.allergies[0] === 'eggs',
      },
      exclusionsFiltered: {
        expected: ['liver'],
        actual: result3.exclusions,
        pass: result3.exclusions.length === 1 && result3.exclusions[0] === 'liver',
      },
    };

    results.push({
      testCase: 3,
      description: 'Whitespace-only items filtered, duplicates deduped',
      input: { allergies: input3.allergies, exclusions: input3.exclusions },
      output: { allergies: result3.allergies, exclusions: result3.exclusions },
      checks,
      allPassing: Object.values(checks).every((c) => c.pass),
    });
  } catch (error: any) {
    results.push({
      testCase: 3,
      description: 'Whitespace-only items filtered, duplicates deduped',
      input: { allergies: ['  ', 'eggs', '  eggs  ', 'EGGS'], exclusions: ['  ', 'LIVER', ' liver '] },
      output: { allergies: [], exclusions: [] },
      checks: { error: { expected: 'no error', actual: error.message, pass: false } },
      allPassing: false,
    });
  }

  const allPassing = results.every((r) => r.allPassing);

  return NextResponse.json({
    feature: 'Feature #110: Agent 1 cleans and deduplicates string arrays',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount: results.filter((r) => r.allPassing).length,
    results,
  });
}
