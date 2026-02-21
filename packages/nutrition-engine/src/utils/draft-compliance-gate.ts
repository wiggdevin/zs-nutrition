import { containsAllergenTerm, isDietaryCompliant } from './dietary-compliance';
import type { MealPlanDraft, ClientIntake } from '../types/schemas';

export interface DraftViolation {
  dayNumber: number;
  mealSlot: string;
  mealName: string;
  ingredientName?: string;
  violationType: 'allergen' | 'dietary_style';
  violationDetail: string;
}

export function scanDraftForViolations(
  draft: MealPlanDraft,
  clientIntake: ClientIntake
): DraftViolation[] {
  const violations: DraftViolation[] = [];
  const seen = new Set<string>();

  for (const day of draft.days) {
    for (const meal of day.meals) {
      // Check meal name
      for (const allergen of clientIntake.allergies) {
        if (containsAllergenTerm(meal.name, allergen)) {
          const key = `${day.dayNumber}:${meal.slot}:meal:allergen:${allergen}`;
          if (!seen.has(key)) {
            seen.add(key);
            violations.push({
              dayNumber: day.dayNumber,
              mealSlot: meal.slot,
              mealName: meal.name,
              violationType: 'allergen',
              violationDetail: `Meal name "${meal.name}" contains allergen "${allergen}"`,
            });
          }
        }
      }

      if (!isDietaryCompliant(meal.name, clientIntake.dietaryStyle)) {
        const key = `${day.dayNumber}:${meal.slot}:meal:dietary:${clientIntake.dietaryStyle}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push({
            dayNumber: day.dayNumber,
            mealSlot: meal.slot,
            mealName: meal.name,
            violationType: 'dietary_style',
            violationDetail: `Meal name "${meal.name}" violates ${clientIntake.dietaryStyle} diet`,
          });
        }
      }

      // Check primaryProtein
      if (meal.primaryProtein && meal.primaryProtein !== 'none') {
        for (const allergen of clientIntake.allergies) {
          if (containsAllergenTerm(meal.primaryProtein, allergen)) {
            const key = `${day.dayNumber}:${meal.slot}:protein:allergen:${allergen}`;
            if (!seen.has(key)) {
              seen.add(key);
              violations.push({
                dayNumber: day.dayNumber,
                mealSlot: meal.slot,
                mealName: meal.name,
                violationType: 'allergen',
                violationDetail: `Primary protein "${meal.primaryProtein}" contains allergen "${allergen}"`,
              });
            }
          }
        }

        if (!isDietaryCompliant(meal.primaryProtein, clientIntake.dietaryStyle)) {
          const key = `${day.dayNumber}:${meal.slot}:protein:dietary:${clientIntake.dietaryStyle}`;
          if (!seen.has(key)) {
            seen.add(key);
            violations.push({
              dayNumber: day.dayNumber,
              mealSlot: meal.slot,
              mealName: meal.name,
              violationType: 'dietary_style',
              violationDetail: `Primary protein "${meal.primaryProtein}" violates ${clientIntake.dietaryStyle} diet`,
            });
          }
        }
      }

      // Check each draft ingredient
      for (const ingredient of meal.draftIngredients) {
        for (const allergen of clientIntake.allergies) {
          if (containsAllergenTerm(ingredient.name, allergen)) {
            const key = `${day.dayNumber}:${meal.slot}:${ingredient.name}:allergen:${allergen}`;
            if (!seen.has(key)) {
              seen.add(key);
              violations.push({
                dayNumber: day.dayNumber,
                mealSlot: meal.slot,
                mealName: meal.name,
                ingredientName: ingredient.name,
                violationType: 'allergen',
                violationDetail: `Ingredient "${ingredient.name}" contains allergen "${allergen}"`,
              });
            }
          }
        }

        if (!isDietaryCompliant(ingredient.name, clientIntake.dietaryStyle)) {
          const key = `${day.dayNumber}:${meal.slot}:${ingredient.name}:dietary:${clientIntake.dietaryStyle}`;
          if (!seen.has(key)) {
            seen.add(key);
            violations.push({
              dayNumber: day.dayNumber,
              mealSlot: meal.slot,
              mealName: meal.name,
              ingredientName: ingredient.name,
              violationType: 'dietary_style',
              violationDetail: `Ingredient "${ingredient.name}" violates ${clientIntake.dietaryStyle} diet`,
            });
          }
        }
      }
    }
  }

  return violations;
}
