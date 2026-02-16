import {
  ClientIntake,
  MetabolicProfile,
  MealPlanDraft,
  MealPlanDraftSchema,
  DraftMeal,
  DraftDay,
} from '../../types/schemas';
import { MEAL_DATABASE, MealCandidate } from '../../data/meal-database';
import { selectMealWithVariety, rotateMealInPool } from './variety-optimizer';

/**
 * Deterministic meal plan generator for dev/testing.
 * Produces realistic, varied meals that match the user's profile and targets.
 * @param startDate - Optional start date to calculate correct day names (defaults to today)
 */
export function generateDeterministic(
  metabolicProfile: MetabolicProfile,
  intake: ClientIntake,
  startDate?: Date
): MealPlanDraft {
  // Use provided startDate or default to today (UTC to avoid timezone issues)
  const start = startDate ? new Date(startDate) : new Date();
  // Normalize to midnight UTC
  start.setUTCHours(0, 0, 0, 0);

  const dayNames: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  > = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Map JS getDay() (0=Sunday, 1=Monday, etc.) to our dayNames array
  const jsDayToName: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  > = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const trainingDaysSet = new Set(intake.trainingDays);

  // Meal database organized by slot and cuisine
  const mealDB = getMealDatabase(intake);

  const allProteinsUsed = new Set<string>();
  const allCuisinesUsed = new Set<string>();
  const recentMealNames: string[] = [];

  // Track proteins used per day to enforce consecutive-day variety rule
  const proteinsByDay: string[][] = [];

  const days: DraftDay[] = [];

  for (let d = 0; d < intake.planDurationDays; d++) {
    // Calculate the actual date for this day
    const currentDate = new Date(start);
    currentDate.setUTCDate(start.getUTCDate() + d);

    // Get the day name based on the actual date
    const dayName = jsDayToName[currentDate.getUTCDay()];
    const isTrainingDay = trainingDaysSet.has(dayName);
    const dayKcal = isTrainingDay
      ? metabolicProfile.goalKcal + metabolicProfile.trainingDayBonusKcal
      : metabolicProfile.restDayKcal;

    const meals: DraftMeal[] = [];
    const dayProteins: string[] = [];

    // Get proteins from previous day to enforce consecutive-day rule
    const previousDayProteins = d > 0 ? proteinsByDay[d - 1] : [];

    for (const target of metabolicProfile.mealTargets) {
      // Adjust kcal proportionally for training/rest days
      const kcalScale = dayKcal / metabolicProfile.goalKcal;
      const mealKcal = Math.round(target.kcal * kcalScale);
      const mealProtein = Math.round(target.proteinG * kcalScale);
      const mealCarbs = Math.round(target.carbsG * kcalScale);
      const mealFat = Math.round(target.fatG * kcalScale);

      // Pick a meal avoiding variety violations, prioritizing preferred cuisines
      const slotType = target.label.toLowerCase().includes('snack')
        ? 'snack'
        : target.label.toLowerCase();
      const slotData = mealDB[slotType] || mealDB['snack'] || { preferred: [], other: [] };

      const mealsPerDay = intake.mealsPerDay + intake.snacksPerDay;
      const selected = selectMealWithVariety(
        slotData,
        recentMealNames,
        previousDayProteins,
        mealsPerDay
      );

      if (!selected) {
        continue;
      }

      // Rotate the selected meal in its pool to ensure variety
      rotateMealInPool(selected, slotData);

      dayProteins.push(selected.primaryProtein);
      allProteinsUsed.add(selected.primaryProtein);
      allCuisinesUsed.add(selected.cuisine);
      recentMealNames.push(selected.name);

      // Scale prep time to cooking skill
      const skillFactor = Math.max(0.6, 1.2 - intake.cookingSkill * 0.06);
      const prepTime = Math.min(
        intake.prepTimeMaxMin,
        Math.round(selected.basePrepMin * skillFactor)
      );

      meals.push({
        slot: target.label,
        name: selected.name,
        cuisine: selected.cuisine,
        prepTimeMin: prepTime,
        cookTimeMin: selected.baseCookMin,
        estimatedNutrition: {
          kcal: mealKcal,
          proteinG: mealProtein,
          carbsG: mealCarbs,
          fatG: mealFat,
        },
        targetNutrition: {
          kcal: mealKcal,
          proteinG: mealProtein,
          carbsG: mealCarbs,
          fatG: mealFat,
        },
        fatsecretSearchQuery: selected.searchQuery,
        suggestedServings: 1,
        primaryProtein: selected.primaryProtein,
        tags: selected.tags,
      });
    }

    // Store this day's proteins for consecutive-day variety checking
    proteinsByDay.push(dayProteins);

    days.push({
      dayNumber: d + 1,
      dayName: dayNames[d % 7].charAt(0).toUpperCase() + dayNames[d % 7].slice(1),
      isTrainingDay,
      targetKcal: dayKcal,
      meals,
    });
  }

  const draft: MealPlanDraft = {
    days,
    varietyReport: {
      proteinsUsed: [...allProteinsUsed],
      cuisinesUsed: [...allCuisinesUsed],
      recipeIdsUsed: [],
    },
  };

  // Validate against schema
  return MealPlanDraftSchema.parse(draft);
}

/**
 * Returns a meal database filtered by dietary style, allergies, and cooking skill.
 * Organizes meals into preferred and other categories based on cuisine preferences.
 * Cooking skill affects which complexity levels are allowed:
 * - Skill 1-3: simple recipes only
 * - Skill 4-6: simple + moderate recipes
 * - Skill 7-10: simple + moderate + complex recipes
 */
export function getMealDatabase(
  intake: ClientIntake
): Record<string, { preferred: MealCandidate[]; other: MealCandidate[] }> {
  const allergiesLower = new Set(intake.allergies.map((a) => a.toLowerCase()));
  const exclusionsLower = new Set(intake.exclusions.map((e) => e.toLowerCase()));
  const preferredCuisines = new Set(intake.cuisinePreferences.map((c) => c.toLowerCase()));

  // Determine allowed complexity levels based on cooking skill
  const allowedComplexities: Set<'simple' | 'moderate' | 'complex'> = new Set();
  if (intake.cookingSkill <= 3) {
    allowedComplexities.add('simple');
  } else if (intake.cookingSkill <= 6) {
    allowedComplexities.add('simple');
    allowedComplexities.add('moderate');
  } else {
    allowedComplexities.add('simple');
    allowedComplexities.add('moderate');
    allowedComplexities.add('complex');
  }

  const filtered: Record<string, { preferred: MealCandidate[]; other: MealCandidate[] }> = {};
  for (const [slot, meals] of Object.entries(MEAL_DATABASE)) {
    const preferred: MealCandidate[] = [];
    const other: MealCandidate[] = [];

    for (const meal of meals) {
      if (!allowedComplexities.has(meal.complexity)) {
        continue;
      }

      if (!passesDietaryStyle(meal, intake.dietaryStyle)) {
        continue;
      }

      if (!passesAllergyCheck(meal, allergiesLower, exclusionsLower)) {
        continue;
      }

      const isPreferred = preferredCuisines.has(meal.cuisine.toLowerCase());
      if (isPreferred) {
        preferred.push(meal);
      } else {
        other.push(meal);
      }
    }

    filtered[slot] = { preferred, other };
  }

  return filtered;
}

/**
 * Check if a meal passes the dietary style filter.
 */
function passesDietaryStyle(meal: MealCandidate, dietaryStyle: string): boolean {
  switch (dietaryStyle) {
    case 'vegetarian':
      if (meal.tags.includes('meat') || meal.tags.includes('fish')) {
        return false;
      }
      break;
    case 'vegan':
      if (
        meal.tags.includes('meat') ||
        meal.tags.includes('fish') ||
        meal.tags.includes('eggs') ||
        meal.tags.includes('dairy')
      ) {
        return false;
      }
      break;
    case 'pescatarian':
      if (meal.tags.includes('meat')) {
        return false;
      }
      break;
    case 'keto':
      if (!meal.tags.includes('keto')) {
        return false;
      }
      break;
    case 'paleo':
      if (
        meal.tags.includes('grains') ||
        meal.tags.includes('dairy') ||
        meal.tags.includes('legumes')
      ) {
        return false;
      }
      break;
    case 'omnivore':
    default:
      break;
  }
  return true;
}

/**
 * Check if a meal passes the allergy and exclusion filters.
 */
function passesAllergyCheck(
  meal: MealCandidate,
  allergiesLower: Set<string>,
  exclusionsLower: Set<string>
): boolean {
  for (const allergen of allergiesLower) {
    if (
      meal.name.toLowerCase().includes(allergen) ||
      meal.primaryProtein.toLowerCase().includes(allergen)
    ) {
      return false;
    }
  }

  for (const exclusion of exclusionsLower) {
    if (
      meal.name.toLowerCase().includes(exclusion) ||
      meal.primaryProtein.toLowerCase().includes(exclusion)
    ) {
      return false;
    }
  }

  return true;
}
