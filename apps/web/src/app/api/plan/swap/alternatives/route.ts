import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface Meal {
  slot: string;
  name: string;
  cuisine?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  nutrition: MealNutrition;
  confidenceLevel?: string;
}

interface PlanDay {
  dayNumber: number;
  meals: Meal[];
}

/**
 * Check if a meal's nutrition is within tolerance of the target
 * Tolerances: ±3% kcal, ±5% macros (protein, carbs, fat)
 */
function isWithinTolerance(
  mealNutrition: MealNutrition,
  targetNutrition: MealNutrition
): boolean {
  const kcalTolerance = 0.03; // ±3%
  const macroTolerance = 0.05; // ±5%

  // Check calorie tolerance
  const kcalDiff = Math.abs(mealNutrition.kcal - targetNutrition.kcal) / targetNutrition.kcal;
  if (kcalDiff > kcalTolerance) return false;

  // Check protein tolerance
  if (targetNutrition.proteinG > 0) {
    const proteinDiff = Math.abs(mealNutrition.proteinG - targetNutrition.proteinG) / targetNutrition.proteinG;
    if (proteinDiff > macroTolerance) return false;
  }

  // Check carbs tolerance
  if (targetNutrition.carbsG > 0) {
    const carbsDiff = Math.abs(mealNutrition.carbsG - targetNutrition.carbsG) / targetNutrition.carbsG;
    if (carbsDiff > macroTolerance) return false;
  }

  // Check fat tolerance
  if (targetNutrition.fatG > 0) {
    const fatDiff = Math.abs(mealNutrition.fatG - targetNutrition.fatG) / targetNutrition.fatG;
    if (fatDiff > macroTolerance) return false;
  }

  return true;
}

/**
 * Check if a meal respects dietary preferences and exclusions
 */
function respectsDietaryPreferences(
  meal: Meal,
  dietaryStyle: string | null,
  allergies: string[],
  exclusions: string[]
): boolean {
  const mealNameLower = meal.name.toLowerCase();
  const cuisineLower = (meal.cuisine || '').toLowerCase();

  // Check dietary style
  if (dietaryStyle) {
    const style = dietaryStyle.toLowerCase();
    if (style === 'vegetarian' || style === 'vegan') {
      const animalProducts = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'meat', 'egg'];
      if (animalProducts.some(product => mealNameLower.includes(product))) {
        return false;
      }
      if (style === 'vegan') {
        const dairy = ['cheese', 'milk', 'yogurt', 'butter', 'cream'];
        if (dairy.some(d => mealNameLower.includes(d))) {
          return false;
        }
      }
    }
  }

  // Check allergies
  for (const allergy of allergies) {
    if (mealNameLower.includes(allergy.toLowerCase())) {
      return false;
    }
  }

  // Check exclusions
  for (const exclusion of exclusions) {
    if (mealNameLower.includes(exclusion.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * POST /api/plan/swap/alternatives
 *
 * Returns alternative meals for a given slot by looking at other days
 * in the plan that have the same meal slot.
 *
 * Feature #169: Ensures swapped meals maintain macro targets within tolerance:
 * - Calories: ±3%
 * - Protein: ±5%
 * - Carbs: ±5%
 * - Fat: ±5%
 */
export async function POST(req: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planId, dayNumber, slot, currentMealName } = body;

    if (!planId || !dayNumber || !slot) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user owns this plan
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        userId: user.id,
      },
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Get user's dietary preferences and exclusions
    const userProfile = await prisma.userProfile.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const dietaryStyle = userProfile?.dietaryStyle || null;
    const allergies = (userProfile?.allergies as string[]) || [];
    const exclusions = (userProfile?.exclusions as string[]) || [];

    // Parse the validated plan
    let validatedPlan: { days: PlanDay[] };
    try {
      validatedPlan = typeof mealPlan.validatedPlan === 'string'
        ? JSON.parse(mealPlan.validatedPlan)
        : mealPlan.validatedPlan as { days: PlanDay[] };
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan data' }, { status: 500 });
    }

    // Find the current day and the meal being swapped
    const currentDay = (validatedPlan.days || []).find(d => d.dayNumber === dayNumber);
    if (!currentDay) {
      return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 });
    }

    // Find the target meal to get its nutrition as the baseline
    const targetMeal = currentDay.meals?.find(m => m.slot?.toLowerCase() === slot.toLowerCase());
    if (!targetMeal) {
      return NextResponse.json({ error: 'Meal slot not found' }, { status: 404 });
    }

    // Collect all meals on current day for variety exclusion
    const currentDayMealNames = new Set<string>();
    if (currentDay?.meals) {
      for (const meal of currentDay.meals) {
        currentDayMealNames.add(meal.name.toLowerCase());
      }
    }

    // Collect alternative meals from other days with the same slot
    // Filter by macro tolerance and dietary preferences
    const alternatives: Meal[] = [];
    const seenNames = new Set<string>();
    if (currentMealName) {
      seenNames.add(currentMealName.toLowerCase());
    }

    for (const day of (validatedPlan.days || [])) {
      if (day.dayNumber === dayNumber) continue;
      for (const meal of (day.meals || [])) {
        const mealNameLower = meal.name.toLowerCase();

        // Skip if already seen or on current day
        if (
          meal.slot?.toLowerCase() !== slot.toLowerCase() ||
          seenNames.has(mealNameLower) ||
          currentDayMealNames.has(mealNameLower)
        ) {
          continue;
        }

        // Check if meal is within macro tolerance of target
        if (!isWithinTolerance(meal.nutrition, targetMeal.nutrition)) {
          continue;
        }

        // Check if meal respects dietary preferences
        if (!respectsDietaryPreferences(meal, dietaryStyle, allergies, exclusions)) {
          continue;
        }

        // Add to alternatives
        seenNames.add(mealNameLower);
        alternatives.push({
          slot: meal.slot,
          name: meal.name,
          cuisine: meal.cuisine,
          prepTimeMin: meal.prepTimeMin,
          cookTimeMin: meal.cookTimeMin,
          nutrition: meal.nutrition,
          confidenceLevel: meal.confidenceLevel || 'ai_estimated',
        });
      }
    }

    return NextResponse.json({ alternatives });
  } catch (error) {
    safeLogError('Error fetching swap alternatives:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
