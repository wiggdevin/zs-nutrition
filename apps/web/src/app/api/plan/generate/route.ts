import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { savePlanToDatabase } from '@/lib/save-plan';
import { requireActiveUser, isDevMode } from '@/lib/auth';
import { planGenerationLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/safe-logger';

const useMockQueue = process.env.USE_MOCK_QUEUE === 'true';

// POST - Create a plan generation job
export async function POST() {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    // Rate limit: 5 plan generations per hour per user
    const rateLimitResult = await checkRateLimit(planGenerationLimiter, clerkUserId);
    if (rateLimitResult && !rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult.reset);
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

    // Parse allergies and exclusions from JSON strings in profile
    const allergies = activeProfile.allergies ? JSON.parse(activeProfile.allergies) : [];
    const exclusions = activeProfile.exclusions ? JSON.parse(activeProfile.exclusions) : [];

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
          allergies,
          exclusions,
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

        const simulatedPlanData = generateSimulatedPlan(
          activeProfile,
          startDate,
          allergies,
          exclusions,
          activeProfile.prepTimeMax
        );
        const simulatedMetabolicProfile = calculateSimulatedMetabolicProfile(activeProfile);

        const saveResult = await savePlanToDatabase({
          jobId: job.id,
          planData: simulatedPlanData,
          metabolicProfile: simulatedMetabolicProfile,
        });

        if (saveResult.success) {
          planId = saveResult.planId;
          logger.debug(`[Dev Mode] Plan saved to database: ${planId}`);
        } else {
          logger.warn('[Dev Mode] Failed to save plan:', saveResult.error);
        }
      } catch (saveError) {
        logger.warn('[Dev Mode] Error saving simulated plan:', saveError);
        // Non-blocking: job is still created, just won't have a MealPlan yet
      }
    }

    const response = NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      planId,
    });
    return response;
  } catch (error) {
    logger.error('Plan generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate a realistic simulated meal plan from user profile data.
 * Used in dev mode when there's no real nutrition engine pipeline.
 *
 * @param profile - User profile data
 * @param startDate - The start date of the meal plan (used to calculate correct day names)
 * @param allergies - Array of food allergies (e.g., ['peanuts', 'shellfish'])
 * @param exclusions - Array of foods to exclude (e.g., ['mushrooms'])
 * @param prepTimeMax - Maximum prep time in minutes (user preference)
 */
function generateSimulatedPlan(
  profile: {
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
  },
  startDate: Date,
  allergies: string[] = [],
  exclusions: string[] = [],
  prepTimeMax: number = 30
) {
  // Calculate approximate calorie target
  const bmr =
    profile.sex === 'male'
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
  if (profile.goalType === 'cut') goalKcal = tdee - profile.goalRate * 500;
  if (profile.goalType === 'bulk') goalKcal = tdee + profile.goalRate * 500;
  goalKcal = Math.round(goalKcal);

  // Macro splits based on macroStyle
  let proteinPct = 0.3,
    carbsPct = 0.4,
    fatPct = 0.3;
  if (profile.macroStyle === 'high_protein') {
    proteinPct = 0.4;
    carbsPct = 0.3;
    fatPct = 0.3;
  }
  if (profile.macroStyle === 'low_carb') {
    proteinPct = 0.35;
    carbsPct = 0.25;
    fatPct = 0.4;
  }
  if (profile.macroStyle === 'keto') {
    proteinPct = 0.25;
    carbsPct = 0.05;
    fatPct = 0.7;
  }

  const proteinG = Math.round((goalKcal * proteinPct) / 4);
  const carbsG = Math.round((goalKcal * carbsPct) / 4);
  const fatG = Math.round((goalKcal * fatPct) / 9);

  // Day names array starting from Sunday (JavaScript getDay() convention)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Build meal slots based on mealsPerDay and snacksPerDay
  // mealsPerDay: 2-6 main meals
  // snacksPerDay: 0-4 snacks
  const mealSlots: string[] = [];

  // Add main meals
  const mainMealLabels = ['Breakfast', 'Lunch', 'Dinner', 'Meal 4', 'Meal 5', 'Meal 6'];
  for (let i = 0; i < profile.mealsPerDay; i++) {
    mealSlots.push(mainMealLabels[i]);
  }

  // Add snacks
  for (let i = 0; i < profile.snacksPerDay; i++) {
    mealSlots.push(`Snack ${i + 1}`);
  }

  // Combine all restrictions into a single set (lowercase for easy matching)
  const restrictedFoods = new Set([
    ...allergies.map((a) => a.toLowerCase()),
    ...exclusions.map((e) => e.toLowerCase()),
  ]);

  // Helper function to check if a meal name contains restricted foods
  function mealContainsRestrictions(mealName: string): boolean {
    const lowerName = mealName.toLowerCase();
    for (const food of restrictedFoods) {
      if (lowerName.includes(food)) {
        return true;
      }
    }
    // Also check for related allergens
    if (restrictedFoods.has('peanuts') || restrictedFoods.has('tree nuts')) {
      if (
        lowerName.includes('peanut') ||
        lowerName.includes('almond') ||
        lowerName.includes('cashew') ||
        lowerName.includes('walnut') ||
        lowerName.includes('pecan') ||
        lowerName.includes('trail mix') ||
        lowerName.includes('mixed nuts')
      ) {
        return true;
      }
    }
    if (restrictedFoods.has('dairy')) {
      if (
        lowerName.includes('yogurt') ||
        lowerName.includes('cheese') ||
        lowerName.includes('milk') ||
        lowerName.includes('cottage cheese')
      ) {
        return true;
      }
    }
    if (restrictedFoods.has('eggs')) {
      if (lowerName.includes('egg')) {
        return true;
      }
    }
    if (restrictedFoods.has('fish') || restrictedFoods.has('shellfish')) {
      if (
        lowerName.includes('salmon') ||
        lowerName.includes('cod') ||
        lowerName.includes('shrimp') ||
        lowerName.includes('poke') ||
        lowerName.includes('fish')
      ) {
        return true;
      }
    }
    if (restrictedFoods.has('wheat') || restrictedFoods.has('gluten')) {
      if (
        lowerName.includes('wheat') ||
        lowerName.includes('bread') ||
        lowerName.includes('pasta') ||
        lowerName.includes('tortilla') ||
        lowerName.includes('wrap') ||
        lowerName.includes('pancake') ||
        lowerName.includes('oat')
      ) {
        return true;
      }
    }
    if (restrictedFoods.has('soy')) {
      if (
        lowerName.includes('soy') ||
        lowerName.includes('edamame') ||
        lowerName.includes('tofu')
      ) {
        return true;
      }
    }
    if (restrictedFoods.has('sesame')) {
      if (lowerName.includes('sesame') || lowerName.includes('hummus')) {
        return true;
      }
    }
    return false;
  }

  // Helper function to filter meal options to only safe meals
  function getSafeMealOptions(
    slotOptions: Array<{ name: string; slot: string }>
  ): Array<{ name: string; slot: string }> {
    if (restrictedFoods.size === 0) {
      return slotOptions; // No restrictions, return all meals
    }
    return slotOptions.filter((meal) => !mealContainsRestrictions(meal.name));
  }

  const sampleMeals: Record<string, Array<{ name: string; slot: string }>> = {
    Breakfast: [
      { name: 'Greek Yogurt Parfait with Berries', slot: 'Breakfast' },
      { name: 'Scrambled Eggs with Spinach Toast', slot: 'Breakfast' },
      { name: 'Overnight Oats with Banana', slot: 'Breakfast' },
      { name: 'Protein Smoothie Bowl', slot: 'Breakfast' },
      { name: 'Avocado Toast with Poached Eggs', slot: 'Breakfast' },
      { name: 'Whole Grain Pancakes with Berries', slot: 'Breakfast' },
      { name: 'Breakfast Burrito with Turkey', slot: 'Breakfast' },
      // Nut-free alternatives
      { name: 'Fresh Fruit Salad with Chia Seeds', slot: 'Breakfast' },
      { name: 'Bacon and Sweet Potato Hash', slot: 'Breakfast' },
      // Dairy-free alternatives
      { name: 'Coconut Yogurt Parfait', slot: 'Breakfast' },
      { name: 'Smoothie with Coconut Milk', slot: 'Breakfast' },
      // Egg-free alternatives
      { name: 'Nut Butter Toast with Banana', slot: 'Breakfast' },
      { name: 'Chia Pudding with Fruit', slot: 'Breakfast' },
      // Gluten-free alternatives
      { name: 'Scrambled Eggs with Avocado', slot: 'Breakfast' },
      { name: 'Gluten-Free Protein Pancakes', slot: 'Breakfast' },
    ],
    Lunch: [
      { name: 'Grilled Chicken Caesar Salad', slot: 'Lunch' },
      { name: 'Turkey and Avocado Wrap', slot: 'Lunch' },
      { name: 'Quinoa Power Bowl', slot: 'Lunch' },
      { name: 'Mediterranean Chicken Bowl', slot: 'Lunch' },
      { name: 'Salmon Poke Bowl', slot: 'Lunch' },
      { name: 'Southwest Black Bean Bowl', slot: 'Lunch' },
      { name: 'Asian Chicken Lettuce Wraps', slot: 'Lunch' },
      // Fish-free alternatives
      { name: 'Grilled Chicken Buddha Bowl', slot: 'Lunch' },
      { name: 'Beef and Vegetable Stir-Fry', slot: 'Lunch' },
      { name: 'Lentil Soup with Side Salad', slot: 'Lunch' },
      // Wheat/gluten-free alternatives
      { name: 'Chicken Rice Bowl', slot: 'Lunch' },
      { name: 'Mediterranean Salad with Grilled Chicken', slot: 'Lunch' },
      { name: 'Stuffed Bell Peppers with Beef', slot: 'Lunch' },
    ],
    Dinner: [
      { name: 'Grilled Salmon with Roasted Vegetables', slot: 'Dinner' },
      { name: 'Chicken Stir-Fry with Brown Rice', slot: 'Dinner' },
      { name: 'Lean Beef Tacos with Corn Tortillas', slot: 'Dinner' },
      { name: 'Baked Cod with Sweet Potato', slot: 'Dinner' },
      { name: 'Turkey Meatballs with Zucchini Noodles', slot: 'Dinner' },
      { name: 'Herb-Crusted Chicken Thighs', slot: 'Dinner' },
      { name: 'Shrimp and Vegetable Skewers', slot: 'Dinner' },
      // Fish-free alternatives
      { name: 'Grilled Chicken Breast with Asparagus', slot: 'Dinner' },
      { name: 'Beef Stir-Fry with Vegetables', slot: 'Dinner' },
      { name: 'Pork Tenderloin with Roasted Potatoes', slot: 'Dinner' },
      { name: 'Lentil Curry with Rice', slot: 'Dinner' },
      { name: 'Vegetable Paella', slot: 'Dinner' },
    ],
    'Snack 1': [
      { name: 'Apple Slices with Almond Butter', slot: 'Snack 1' },
      { name: 'Protein Bar', slot: 'Snack 1' },
      { name: 'Trail Mix (30g)', slot: 'Snack 1' },
      { name: 'Cottage Cheese with Pineapple', slot: 'Snack 1' },
      { name: 'Rice Cakes with Peanut Butter', slot: 'Snack 1' },
      { name: 'Hummus with Veggie Sticks', slot: 'Snack 1' },
      { name: 'Hard-Boiled Eggs (2)', slot: 'Snack 1' },
      // Nut-free alternatives
      { name: 'Fresh Berries', slot: 'Snack 1' },
      { name: 'Carrot Sticks with Guacamole', slot: 'Snack 1' },
      { name: 'Rice Cakes with Avocado', slot: 'Snack 1' },
      { name: 'Beef Jerky', slot: 'Snack 1' },
      { name: 'Olives', slot: 'Snack 1' },
      // Dairy-free alternatives
      { name: 'Coconut Yogurt Cup', slot: 'Snack 1' },
      { name: 'Fresh Fruit Cup', slot: 'Snack 1' },
      // Egg-free alternatives
      { name: 'Nut Butter on Celery', slot: 'Snack 1' },
    ],
    'Snack 2': [
      { name: 'Mixed Nuts (25g)', slot: 'Snack 2' },
      { name: 'Greek Yogurt Cup', slot: 'Snack 2' },
      { name: 'Banana with Peanut Butter', slot: 'Snack 2' },
      { name: 'Edamame (100g)', slot: 'Snack 2' },
      { name: 'Dark Chocolate (20g) with Almonds', slot: 'Snack 2' },
      { name: 'Cheese Stick with Crackers', slot: 'Snack 2' },
      { name: 'Whey Protein Shake', slot: 'Snack 2' },
      // Nut-free alternatives
      { name: 'Fresh Pear', slot: 'Snack 2' },
      { name: 'Roasted Chickpeas', slot: 'Snack 2' },
      { name: 'Beef Jerky', slot: 'Snack 2' },
      { name: 'Sunflower Seeds', slot: 'Snack 2' },
      // Dairy-free alternatives
      { name: 'Coconut Chia Pudding', slot: 'Snack 2' },
      { name: 'Dried Fruit', slot: 'Snack 2' },
      // Soy-free alternatives
      { name: 'Protein Shake (Whey)', slot: 'Snack 2' },
    ],
    'Snack 3': [
      { name: 'Apple Slices with Peanut Butter', slot: 'Snack 3' },
      { name: 'Protein Smoothie', slot: 'Snack 3' },
      { name: 'Trail Mix (30g)', slot: 'Snack 3' },
      { name: 'Cottage Cheese with Berries', slot: 'Snack 3' },
      { name: 'Rice Cakes with Almond Butter', slot: 'Snack 3' },
      { name: 'Beef Jerky', slot: 'Snack 3' },
      { name: 'Hard-Boiled Eggs (2)', slot: 'Snack 3' },
    ],
    'Snack 4': [
      { name: 'Mixed Nuts (25g)', slot: 'Snack 4' },
      { name: 'Greek Yogurt Cup', slot: 'Snack 4' },
      { name: 'Banana with Peanut Butter', slot: 'Snack 4' },
      { name: 'Edamame (100g)', slot: 'Snack 4' },
      { name: 'Dark Chocolate (20g)', slot: 'Snack 4' },
      { name: 'Cheese Stick', slot: 'Snack 4' },
      { name: 'Protein Shake', slot: 'Snack 4' },
    ],
    'Meal 4': [
      { name: 'Grilled Chicken Breast', slot: 'Meal 4' },
      { name: 'Turkey Meatballs', slot: 'Meal 4' },
      { name: 'Beef Stir-Fry', slot: 'Meal 4' },
      { name: 'Salmon Fillet', slot: 'Meal 4' },
      { name: 'Tofu Vegetable Bowl', slot: 'Meal 4' },
    ],
    'Meal 5': [
      { name: 'Chicken Thighs', slot: 'Meal 5' },
      { name: 'Lean Beef Steak', slot: 'Meal 5' },
      { name: 'Pork Tenderloin', slot: 'Meal 5' },
      { name: 'Cod Fillet', slot: 'Meal 5' },
      { name: 'Tempeh Bowl', slot: 'Meal 5' },
    ],
    'Meal 6': [
      { name: 'Grilled Chicken', slot: 'Meal 6' },
      { name: 'Ground Turkey', slot: 'Meal 6' },
      { name: 'Beef Roast', slot: 'Meal 6' },
      { name: 'Shrimp', slot: 'Meal 6' },
      { name: 'Edamame Bowl', slot: 'Meal 6' },
    ],
  };

  // Generate exactly 7 days starting from startDate
  const days = Array.from({ length: 7 }, (_, idx) => {
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
      // Get meal options for this slot, or fallback to appropriate default
      const allMealOptions =
        sampleMeals[slot] ||
        (slot.startsWith('Snack') ? sampleMeals['Snack 1'] : sampleMeals['Lunch']);
      // Filter out meals that contain allergens or excluded foods
      const safeMealOptions = getSafeMealOptions(allMealOptions);

      // If no safe meals available, use a fallback
      if (safeMealOptions.length === 0) {
        logger.warn(
          `No safe meals available for ${slot} with restrictions:`,
          Array.from(restrictedFoods)
        );
      }

      // Select from safe options, cycling through them
      const mealOptions = safeMealOptions.length > 0 ? safeMealOptions : allMealOptions;
      const meal = mealOptions[idx % mealOptions.length];
      const mealProtein = Math.round(proteinG / mealSlots.length);
      const mealCarbs = Math.round(carbsG / mealSlots.length);
      const mealFat = Math.round(fatG / mealSlots.length);

      // Generate prep time that respects user's max prep time constraint
      // Base range is 5-25 minutes, but capped at prepTimeMax
      const minPrep = 5;
      const maxPrep = Math.min(25, prepTimeMax);
      const prepTime = minPrep + Math.round(Math.random() * (maxPrep - minPrep));

      return {
        slot: meal.slot,
        name: meal.name,
        cuisine: 'American',
        prepTimeMin: prepTime,
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
        instructions: ['Prepare ingredients', 'Cook according to recipe', 'Plate and serve'],
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
  const bmrKcal =
    profile.sex === 'male'
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

  const proteinTargetG = Math.round((goalKcal * 0.3) / 4);
  const carbsTargetG = Math.round((goalKcal * 0.4) / 4);
  const fatTargetG = Math.round((goalKcal * 0.3) / 9);

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
