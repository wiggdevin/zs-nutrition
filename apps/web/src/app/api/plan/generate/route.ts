import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { savePlanToDatabase } from '@/lib/save-plan';
import { getClerkUserId, isDevMode } from '@/lib/auth';
import { checkRateLimit, addRateLimitHeaders, rateLimitExceededResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { safeLogError, safeLogWarn } from '@/lib/safe-logger';

const useMockQueue = process.env.USE_MOCK_QUEUE === 'true';

// POST - Create a plan generation job
export async function POST() {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 3 plan generations per hour per user
    const rateLimitResult = checkRateLimit(clerkUserId, RATE_LIMITS.planGeneration);
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult, RATE_LIMITS.planGeneration);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        profiles: {
          where: { isActive: true },
          take: 1,
        },
        onboarding: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email: `${clerkUserId}@dev.local`,
        },
        include: {
          profiles: {
            where: { isActive: true },
            take: 1,
          },
          onboarding: true,
        },
      });
    }

    if (!user.onboarding?.completed) {
      return NextResponse.json({ error: 'Onboarding not completed' }, { status: 400 });
    }

    const activeProfile = user.profiles[0];
    if (!activeProfile) {
      return NextResponse.json({ error: 'No active profile found' }, { status: 400 });
    }

    // Check for existing pending/running jobs to prevent duplicates
    const existingJob = await prisma.planGenerationJob.findFirst({
      where: {
        userId: user.id,
        status: { in: ['pending', 'running'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingJob) {
      // Return existing job instead of creating duplicate
      const response = NextResponse.json({
        success: true,
        jobId: existingJob.id,
        status: existingJob.status,
        existing: true,
      });
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    // Create a plan generation job
    const jobId = uuidv4();
    const job = await prisma.planGenerationJob.create({
      data: {
        id: jobId,
        userId: user.id,
        status: 'pending',
        intakeData: JSON.stringify({
          name: activeProfile.name,
          sex: activeProfile.sex,
          age: activeProfile.age,
          heightCm: activeProfile.heightCm,
          weightKg: activeProfile.weightKg,
          goalType: activeProfile.goalType,
          goalRate: activeProfile.goalRate,
          activityLevel: activeProfile.activityLevel,
          dietaryStyle: activeProfile.dietaryStyle,
          macroStyle: activeProfile.macroStyle,
          mealsPerDay: activeProfile.mealsPerDay,
          snacksPerDay: activeProfile.snacksPerDay,
        }),
      },
    });

    // In dev mode with mock queue, simulate pipeline completion
    // by creating the MealPlan record directly (no real worker to process)
    let planId: string | undefined;
    if (isDevMode || useMockQueue) {
      try {
        // Generate a realistic simulated plan based on the user's profile
        // Get today's date to calculate correct day names
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const simulatedPlanData = generateSimulatedPlan(activeProfile, startDate);
        const simulatedMetabolicProfile = calculateSimulatedMetabolicProfile(activeProfile);

        const saveResult = await savePlanToDatabase({
          jobId: job.id,
          planData: simulatedPlanData,
          metabolicProfile: simulatedMetabolicProfile,
        });

        if (saveResult.success) {
          planId = saveResult.planId;
          console.log(`[Dev Mode] Plan saved to database: ${planId}`);
        } else {
          console.warn('[Dev Mode] Failed to save plan:', saveResult.error);
        }
      } catch (saveError) {
        safeLogWarn('[Dev Mode] Error saving simulated plan:', saveError);
        // Non-blocking: job is still created, just won't have a MealPlan yet
      }
    }

    const response = NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      planId,
    });
    addRateLimitHeaders(response, rateLimitResult);
    return response;
  } catch (error) {
    safeLogError('Plan generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate a realistic simulated meal plan from user profile data.
 * Used in dev mode when there's no real nutrition engine pipeline.
 *
 * @param profile - User profile data
 * @param startDate - The start date of the meal plan (used to calculate correct day names)
 */
function generateSimulatedPlan(profile: {
  name: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goalType: string;
  goalRate: number;
  activityLevel: string;
  dietaryStyle: string;
  macroStyle: string;
  mealsPerDay: number;
  snacksPerDay: number;
}, startDate: Date) {
  // Calculate approximate calorie target
  const bmr = profile.sex === 'male'
    ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
    : 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };
  const tdee = bmr * (activityMultipliers[profile.activityLevel] || 1.55);

  let goalKcal = tdee;
  if (profile.goalType === 'cut') goalKcal = tdee - (profile.goalRate * 500);
  if (profile.goalType === 'bulk') goalKcal = tdee + (profile.goalRate * 500);
  goalKcal = Math.round(goalKcal);

  // Macro splits based on macroStyle
  let proteinPct = 0.30, carbsPct = 0.40, fatPct = 0.30;
  if (profile.macroStyle === 'high_protein') { proteinPct = 0.40; carbsPct = 0.30; fatPct = 0.30; }
  if (profile.macroStyle === 'low_carb') { proteinPct = 0.35; carbsPct = 0.25; fatPct = 0.40; }
  if (profile.macroStyle === 'keto') { proteinPct = 0.25; carbsPct = 0.05; fatPct = 0.70; }

  const proteinG = Math.round((goalKcal * proteinPct) / 4);
  const carbsG = Math.round((goalKcal * carbsPct) / 4);
  const fatG = Math.round((goalKcal * fatPct) / 9);

  // Day names array starting from Sunday (JavaScript getDay() convention)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mealSlots = ['Breakfast', 'Lunch', 'Dinner'];
  if (profile.mealsPerDay >= 4) mealSlots.push('Snack 1');
  if (profile.mealsPerDay >= 5) mealSlots.push('Snack 2');

  const sampleMeals: Record<string, Array<{ name: string; slot: string }>> = {
    Breakfast: [
      { name: 'Greek Yogurt Parfait with Berries', slot: 'Breakfast' },
      { name: 'Scrambled Eggs with Spinach Toast', slot: 'Breakfast' },
      { name: 'Overnight Oats with Banana', slot: 'Breakfast' },
      { name: 'Protein Smoothie Bowl', slot: 'Breakfast' },
      { name: 'Avocado Toast with Poached Eggs', slot: 'Breakfast' },
      { name: 'Whole Grain Pancakes with Berries', slot: 'Breakfast' },
      { name: 'Breakfast Burrito with Turkey', slot: 'Breakfast' },
    ],
    Lunch: [
      { name: 'Grilled Chicken Caesar Salad', slot: 'Lunch' },
      { name: 'Turkey and Avocado Wrap', slot: 'Lunch' },
      { name: 'Quinoa Power Bowl', slot: 'Lunch' },
      { name: 'Mediterranean Chicken Bowl', slot: 'Lunch' },
      { name: 'Salmon Poke Bowl', slot: 'Lunch' },
      { name: 'Southwest Black Bean Bowl', slot: 'Lunch' },
      { name: 'Asian Chicken Lettuce Wraps', slot: 'Lunch' },
    ],
    Dinner: [
      { name: 'Grilled Salmon with Roasted Vegetables', slot: 'Dinner' },
      { name: 'Chicken Stir-Fry with Brown Rice', slot: 'Dinner' },
      { name: 'Lean Beef Tacos with Corn Tortillas', slot: 'Dinner' },
      { name: 'Baked Cod with Sweet Potato', slot: 'Dinner' },
      { name: 'Turkey Meatballs with Zucchini Noodles', slot: 'Dinner' },
      { name: 'Herb-Crusted Chicken Thighs', slot: 'Dinner' },
      { name: 'Shrimp and Vegetable Skewers', slot: 'Dinner' },
    ],
    'Snack 1': [
      { name: 'Apple Slices with Almond Butter', slot: 'Snack 1' },
      { name: 'Protein Bar', slot: 'Snack 1' },
      { name: 'Trail Mix (30g)', slot: 'Snack 1' },
      { name: 'Cottage Cheese with Pineapple', slot: 'Snack 1' },
      { name: 'Rice Cakes with Peanut Butter', slot: 'Snack 1' },
      { name: 'Hummus with Veggie Sticks', slot: 'Snack 1' },
      { name: 'Hard-Boiled Eggs (2)', slot: 'Snack 1' },
    ],
    'Snack 2': [
      { name: 'Mixed Nuts (25g)', slot: 'Snack 2' },
      { name: 'Greek Yogurt Cup', slot: 'Snack 2' },
      { name: 'Banana with Peanut Butter', slot: 'Snack 2' },
      { name: 'Edamame (100g)', slot: 'Snack 2' },
      { name: 'Dark Chocolate (20g) with Almonds', slot: 'Snack 2' },
      { name: 'Cheese Stick with Crackers', slot: 'Snack 2' },
      { name: 'Whey Protein Shake', slot: 'Snack 2' },
    ],
  };

  const days = dayNames.map((dayName, idx) => {
    // Calculate the actual day name based on startDate + idx days
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + idx);
    const actualDayName = dayNames[currentDate.getDay()];

    // Determine if this is a training day based on actual day name
    // Mon-Fri are training days (indices 1-5 in dayNames array)
    const isTrainingDay = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;

    const dayKcal = isTrainingDay ? goalKcal : Math.round(goalKcal * 0.9);
    const kcalPerMeal = Math.round(dayKcal / mealSlots.length);

    const meals = mealSlots.map((slot) => {
      const mealOptions = sampleMeals[slot] || sampleMeals['Snack 1'];
      const meal = mealOptions[idx % mealOptions.length];
      const mealProtein = Math.round(proteinG / mealSlots.length);
      const mealCarbs = Math.round(carbsG / mealSlots.length);
      const mealFat = Math.round(fatG / mealSlots.length);

      return {
        slot: meal.slot,
        name: meal.name,
        cuisine: 'American',
        prepTimeMin: 10 + Math.round(Math.random() * 15),
        cookTimeMin: 15 + Math.round(Math.random() * 20),
        nutrition: {
          kcal: kcalPerMeal,
          proteinG: mealProtein,
          carbsG: mealCarbs,
          fatG: mealFat,
          fiberG: 3 + Math.round(Math.random() * 5),
        },
        confidenceLevel: 'verified',
        ingredients: [
          { name: 'Main ingredient', amount: '150g' },
          { name: 'Side ingredient', amount: '100g' },
        ],
        instructions: [
          'Prepare ingredients',
          'Cook according to recipe',
          'Plate and serve',
        ],
      };
    });

    return {
      dayNumber: idx + 1,
      dayName: actualDayName,
      isTrainingDay,
      targetKcal: dayKcal,
      meals,
    };
  });

  return {
    days,
    groceryList: [
      { category: 'Protein', items: ['Chicken breast', 'Salmon fillet', 'Greek yogurt', 'Eggs'] },
      { category: 'Grains', items: ['Brown rice', 'Quinoa', 'Whole grain bread', 'Oats'] },
      { category: 'Vegetables', items: ['Spinach', 'Bell peppers', 'Broccoli', 'Sweet potato'] },
      { category: 'Fruits', items: ['Bananas', 'Berries', 'Apples', 'Avocados'] },
    ],
    qa: {
      status: 'PASS',
      score: 87,
      iterations: 2,
    },
    weeklyTotals: {
      avgKcal: goalKcal,
      avgProteinG: proteinG,
      avgCarbsG: carbsG,
      avgFatG: fatG,
    },
  };
}

/**
 * Calculate simulated metabolic profile from user profile data.
 */
function calculateSimulatedMetabolicProfile(profile: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goalType: string;
  goalRate: number;
  activityLevel: string;
}) {
  const bmrKcal = profile.sex === 'male'
    ? Math.round(10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5)
    : Math.round(10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161);

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };
  const tdeeKcal = Math.round(bmrKcal * (activityMultipliers[profile.activityLevel] || 1.55));

  let goalKcal = tdeeKcal;
  if (profile.goalType === 'cut') goalKcal = tdeeKcal - Math.round(profile.goalRate * 500);
  if (profile.goalType === 'bulk') goalKcal = tdeeKcal + Math.round(profile.goalRate * 500);

  const proteinTargetG = Math.round((goalKcal * 0.30) / 4);
  const carbsTargetG = Math.round((goalKcal * 0.40) / 4);
  const fatTargetG = Math.round((goalKcal * 0.30) / 9);

  return {
    bmrKcal,
    tdeeKcal,
    goalKcal,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    trainingBonusKcal: Math.round(tdeeKcal * 0.1),
  };
}
