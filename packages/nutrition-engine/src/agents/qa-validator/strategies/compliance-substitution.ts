import type { CompiledDay, ClientIntake } from '../../../types/schemas';
import {
  containsAllergenTerm,
  isDietaryCompliant,
  isProductCompliant,
} from '../../../utils/dietary-compliance';
import { recalcDailyTotals } from '../tolerance-checks';

interface SubstitutionCandidate {
  replacement: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  safeFor: string[];
}

export const COMPLIANCE_SUBSTITUTIONS: Record<string, SubstitutionCandidate[]> = {
  cheese: [
    {
      replacement: 'nutritional yeast',
      kcalPer100g: 326,
      proteinPer100g: 54,
      carbsPer100g: 36,
      fatPer100g: 4,
      safeFor: ['dairy', 'vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  milk: [
    {
      replacement: 'oat milk unsweetened',
      kcalPer100g: 40,
      proteinPer100g: 1,
      carbsPer100g: 7,
      fatPer100g: 1.5,
      safeFor: ['dairy', 'vegan'],
    },
  ],
  yogurt: [
    {
      replacement: 'coconut yogurt',
      kcalPer100g: 110,
      proteinPer100g: 1,
      carbsPer100g: 13,
      fatPer100g: 6,
      safeFor: ['dairy', 'vegan'],
    },
  ],
  butter: [
    {
      replacement: 'olive oil',
      kcalPer100g: 884,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 100,
      safeFor: ['dairy', 'vegan'],
    },
  ],
  cream: [
    {
      replacement: 'coconut cream',
      kcalPer100g: 197,
      proteinPer100g: 2,
      carbsPer100g: 7,
      fatPer100g: 20,
      safeFor: ['dairy', 'vegan'],
    },
  ],
  chicken: [
    {
      replacement: 'firm tofu',
      kcalPer100g: 144,
      proteinPer100g: 17,
      carbsPer100g: 3,
      fatPer100g: 9,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
    {
      replacement: 'salmon fillet',
      kcalPer100g: 208,
      proteinPer100g: 20,
      carbsPer100g: 0,
      fatPer100g: 13,
      safeFor: ['pescatarian'],
    },
  ],
  beef: [
    {
      replacement: 'portobello mushroom',
      kcalPer100g: 22,
      proteinPer100g: 3,
      carbsPer100g: 4,
      fatPer100g: 0.4,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
    {
      replacement: 'tuna steak',
      kcalPer100g: 130,
      proteinPer100g: 29,
      carbsPer100g: 0,
      fatPer100g: 1,
      safeFor: ['pescatarian'],
    },
  ],
  pork: [
    {
      replacement: 'jackfruit',
      kcalPer100g: 95,
      proteinPer100g: 2,
      carbsPer100g: 23,
      fatPer100g: 0.6,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  turkey: [
    {
      replacement: 'tempeh',
      kcalPer100g: 192,
      proteinPer100g: 20,
      carbsPer100g: 8,
      fatPer100g: 11,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  lamb: [
    {
      replacement: 'seitan',
      kcalPer100g: 370,
      proteinPer100g: 75,
      carbsPer100g: 14,
      fatPer100g: 2,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  bacon: [
    {
      replacement: 'coconut bacon',
      kcalPer100g: 500,
      proteinPer100g: 5,
      carbsPer100g: 35,
      fatPer100g: 40,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  sausage: [
    {
      replacement: 'beyond sausage',
      kcalPer100g: 210,
      proteinPer100g: 16,
      carbsPer100g: 4,
      fatPer100g: 14,
      safeFor: ['vegan', 'vegetarian', 'pescatarian'],
    },
  ],
  egg: [
    {
      replacement: 'silken tofu',
      kcalPer100g: 55,
      proteinPer100g: 5,
      carbsPer100g: 2,
      fatPer100g: 3,
      safeFor: ['egg', 'vegan'],
    },
  ],
};

export function findSafeSubstitution(
  ingredientName: string,
  violatingTerm: string,
  clientIntake: ClientIntake,
  gramsNeeded: number
): {
  name: string;
  amount: number;
  unit: string;
  nutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number };
} | null {
  const patternKey = violatingTerm.toLowerCase();
  const candidates = COMPLIANCE_SUBSTITUTIONS[patternKey];
  if (!candidates) {
    return null;
  }

  for (const candidate of candidates) {
    if (
      isProductCompliant(candidate.replacement, clientIntake.allergies, clientIntake.dietaryStyle)
    ) {
      const scale = gramsNeeded / 100;
      return {
        name: candidate.replacement,
        amount: gramsNeeded,
        unit: 'g',
        nutrition: {
          kcal: Math.round(candidate.kcalPer100g * scale),
          proteinG: Math.round(candidate.proteinPer100g * scale * 10) / 10,
          carbsG: Math.round(candidate.carbsPer100g * scale * 10) / 10,
          fatG: Math.round(candidate.fatPer100g * scale * 10) / 10,
        },
      };
    }
  }

  return null;
}

export function repairComplianceViolations(
  day: CompiledDay,
  clientIntake: ClientIntake
): { adjustedDay: CompiledDay; description: string } | null {
  let changesMade = false;
  const descriptions: string[] = [];

  const newMeals = day.meals.map((meal) => {
    const newIngredients = meal.ingredients.map((ing) => {
      // Check against all allergies
      let violatingAllergen: string | null = null;
      for (const allergen of clientIntake.allergies) {
        if (containsAllergenTerm(ing.name, allergen)) {
          violatingAllergen = allergen;
          break;
        }
      }

      // Check dietary style
      let violatingDietTerm: string | null = null;
      if (!violatingAllergen && !isDietaryCompliant(ing.name, clientIntake.dietaryStyle)) {
        // Find which term triggered the violation
        const lower = ing.name.toLowerCase();
        for (const pattern of Object.keys(COMPLIANCE_SUBSTITUTIONS)) {
          if (lower.includes(pattern)) {
            violatingDietTerm = pattern;
            break;
          }
        }
      }

      const violatingTerm = violatingAllergen || violatingDietTerm;
      if (!violatingTerm) {
        return ing;
      }

      const gramsNeeded = ing.amount > 0 ? ing.amount : 100;
      const sub = findSafeSubstitution(ing.name, violatingTerm, clientIntake, gramsNeeded);
      if (!sub) {
        return ing;
      }

      changesMade = true;
      descriptions.push(`"${ing.name}" -> "${sub.name}"`);

      return {
        ...ing,
        name: sub.name,
        amount: sub.amount,
        unit: sub.unit,
      };
    });

    if (!changesMade || newIngredients === meal.ingredients) {
      return meal;
    }

    // Recalculate meal nutrition from substituted ingredients
    let mealKcal = 0;
    let mealProtein = 0;
    let mealCarbs = 0;
    let mealFat = 0;

    for (const ing of newIngredients) {
      // Check if this was a substituted ingredient by looking up in COMPLIANCE_SUBSTITUTIONS
      let found = false;
      for (const candidates of Object.values(COMPLIANCE_SUBSTITUTIONS)) {
        for (const c of candidates) {
          if (c.replacement === ing.name) {
            const scale = ing.amount / 100;
            mealKcal += c.kcalPer100g * scale;
            mealProtein += c.proteinPer100g * scale;
            mealCarbs += c.carbsPer100g * scale;
            mealFat += c.fatPer100g * scale;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        // Original ingredient — use existing meal nutrition proportionally
        const ingCount = meal.ingredients.length;
        if (ingCount > 0) {
          mealKcal += meal.nutrition.kcal / ingCount;
          mealProtein += meal.nutrition.proteinG / ingCount;
          mealCarbs += meal.nutrition.carbsG / ingCount;
          mealFat += meal.nutrition.fatG / ingCount;
        }
      }
    }

    return {
      ...meal,
      ingredients: newIngredients,
      nutrition: {
        ...meal.nutrition,
        kcal: Math.round(mealKcal),
        proteinG: Math.round(mealProtein * 10) / 10,
        carbsG: Math.round(mealCarbs * 10) / 10,
        fatG: Math.round(mealFat * 10) / 10,
      },
    };
  });

  if (!changesMade) {
    return null;
  }

  const newTotals = recalcDailyTotals(newMeals);
  const targetKcal = day.targetKcal;
  const newVarianceKcal = newTotals.kcal - targetKcal;
  const newVariancePercent =
    targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

  const adjustedDay: CompiledDay = {
    ...day,
    meals: newMeals,
    dailyTotals: newTotals,
    varianceKcal: Math.round(newVarianceKcal),
    variancePercent: newVariancePercent,
  };

  return {
    adjustedDay,
    description: `Day ${day.dayNumber}: [compliance-substitution] Replaced ${descriptions.join(', ')}`,
  };
}
