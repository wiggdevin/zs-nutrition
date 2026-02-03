import { ClientIntake, MetabolicProfile, MealPlanDraft, MealPlanDraftSchema, DraftMeal, DraftDay } from '../types/schemas';

/**
 * Agent 3: Recipe Curator (LLM)
 * Generates meal ideas matching calorie/macro targets via Claude.
 * Enforces variety rules: no repeated proteins on consecutive days,
 * no identical meals within 3 days, spread cuisines, mix cooking methods.
 *
 * Falls back to a deterministic meal generator when no API key is available
 * (for development/testing without Anthropic credentials).
 */
export class RecipeCurator {
  constructor(private anthropicApiKey: string) {}

  async generate(
    metabolicProfile: MetabolicProfile,
    intake: ClientIntake
  ): Promise<MealPlanDraft> {
    // Attempt Claude-based generation if API key is available
    if (this.anthropicApiKey && this.anthropicApiKey !== '' && !this.anthropicApiKey.includes('YOUR_KEY')) {
      try {
        return await this.generateWithClaude(metabolicProfile, intake);
      } catch (error) {
        console.warn('[RecipeCurator] Claude generation failed, falling back to deterministic:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Fallback: deterministic generation for dev/testing
    return this.generateDeterministic(metabolicProfile, intake);
  }

  /**
   * Generate meal plan draft using Claude API
   */
  private async generateWithClaude(
    metabolicProfile: MetabolicProfile,
    intake: ClientIntake
  ): Promise<MealPlanDraft> {
    const prompt = this.buildPrompt(metabolicProfile, intake);

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.anthropicApiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textBlock = response.content.find((block: { type: string }) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from Claude's response
    const jsonStr = this.extractJson(textBlock.text);
    const parsed = JSON.parse(jsonStr);

    // Validate against schema
    return MealPlanDraftSchema.parse(parsed);
  }

  /**
   * Build the prompt for Claude to generate a meal plan draft
   */
  private buildPrompt(metabolicProfile: MetabolicProfile, intake: ClientIntake): string {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const trainingDaysSet = new Set(intake.trainingDays);

    return `You are a nutrition expert creating a personalized 7-day meal plan.

## Client Profile
- Name: ${intake.name}
- Sex: ${intake.sex}, Age: ${intake.age}
- Dietary Style: ${intake.dietaryStyle}
- Allergies: ${intake.allergies.length > 0 ? intake.allergies.join(', ') : 'None'}
- Exclusions: ${intake.exclusions.length > 0 ? intake.exclusions.join(', ') : 'None'}
- Cuisine Preferences: ${intake.cuisinePreferences.length > 0 ? intake.cuisinePreferences.join(', ') : 'Any'}
- Cooking Skill: ${intake.cookingSkill}/10
- Max Prep Time: ${intake.prepTimeMaxMin} minutes
- Goal: ${intake.goalType} (${intake.goalRate} rate)

## Nutritional Targets
- Daily Calories: ${metabolicProfile.goalKcal} kcal
- Protein: ${metabolicProfile.proteinTargetG}g
- Carbs: ${metabolicProfile.carbsTargetG}g
- Fat: ${metabolicProfile.fatTargetG}g
- Meals per day: ${intake.mealsPerDay}
- Snacks per day: ${intake.snacksPerDay}
- Training days: ${intake.trainingDays.join(', ')}

## Meal Slot Targets
${metabolicProfile.mealTargets.map((t) => `- ${t.label}: ${t.kcal} kcal (P: ${t.proteinG}g, C: ${t.carbsG}g, F: ${t.fatG}g)`).join('\n')}

## Variety Rules (MUST follow)
1. No repeated primary protein on consecutive days
2. No identical meal within a 3-day window
3. Spread cuisines across at least 3 different types over the week
4. Mix cooking methods (grilling, baking, stir-fry, raw/no-cook)

## Output Format
Return ONLY valid JSON (no markdown, no explanation) matching this exact structure:
{
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "isTrainingDay": true,
      "targetKcal": ${metabolicProfile.goalKcal},
      "meals": [
        {
          "slot": "breakfast",
          "name": "Meal Name Here",
          "cuisine": "Italian",
          "prepTimeMin": 15,
          "cookTimeMin": 20,
          "estimatedNutrition": { "kcal": 500, "proteinG": 35, "carbsG": 40, "fatG": 18 },
          "fatsecretSearchQuery": "grilled chicken breast rice",
          "suggestedServings": 1,
          "primaryProtein": "chicken",
          "tags": ["high-protein", "quick"]
        }
      ]
    }
  ],
  "varietyReport": {
    "proteinsUsed": ["chicken", "salmon", ...],
    "cuisinesUsed": ["Italian", "Mexican", ...],
    "recipeIdsUsed": []
  }
}

Generate ${intake.planDurationDays} days. Each day should have ${intake.mealsPerDay} meals${intake.snacksPerDay > 0 ? ` and ${intake.snacksPerDay} snack(s)` : ''}.
Slot names for meals: ${metabolicProfile.mealTargets.map((t) => t.label).join(', ')}.
Training days: ${dayNames.filter((_, i) => trainingDaysSet.has(dayNames[i].toLowerCase() as typeof intake.trainingDays[number])).join(', ')}.
Rest days get ${metabolicProfile.restDayKcal} kcal.
Training days get ${metabolicProfile.goalKcal + metabolicProfile.trainingDayBonusKcal} kcal.`;
  }

  /**
   * Extract JSON from Claude's response (handles markdown code blocks)
   */
  private extractJson(text: string): string {
    // Try to find JSON in code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    // Otherwise try to find raw JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in Claude response');
  }

  /**
   * Deterministic meal plan generator for dev/testing.
   * Produces realistic, varied meals that match the user's profile and targets.
   * @param startDate - Optional start date to calculate correct day names (defaults to today)
   */
  private generateDeterministic(
    metabolicProfile: MetabolicProfile,
    intake: ClientIntake,
    startDate?: Date
  ): MealPlanDraft {
    // Use provided startDate or default to today (UTC to avoid timezone issues)
    const start = startDate ? new Date(startDate) : new Date();
    // Normalize to midnight UTC
    start.setUTCHours(0, 0, 0, 0);

    const dayNames: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> =
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Map JS getDay() (0=Sunday, 1=Monday, etc.) to our dayNames array
    const jsDayToName: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> =
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const trainingDaysSet = new Set(intake.trainingDays);

    // Meal database organized by slot and cuisine
    const mealDB = this.getMealDatabase(intake);

    const usedProteins: string[] = [];
    const allProteinsUsed = new Set<string>();
    const allCuisinesUsed = new Set<string>();
    const recentMealNames: string[] = [];

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

      for (const target of metabolicProfile.mealTargets) {
        // Adjust kcal proportionally for training/rest days
        const kcalScale = dayKcal / metabolicProfile.goalKcal;
        const mealKcal = Math.round(target.kcal * kcalScale);
        const mealProtein = Math.round(target.proteinG * kcalScale);
        const mealCarbs = Math.round(target.carbsG * kcalScale);
        const mealFat = Math.round(target.fatG * kcalScale);

        // Pick a meal avoiding variety violations
        const slotType = target.label.includes('snack') ? 'snack' : target.label;
        const candidates = mealDB[slotType] || mealDB['snack'] || [];

        let selected = candidates[0];
        for (const candidate of candidates) {
          // Check: not used in last 3 meals of same slot
          const recentSlotMeals = recentMealNames.slice(-21); // ~3 days worth
          if (recentSlotMeals.includes(candidate.name)) continue;

          // Check: no consecutive same protein
          const lastProtein = usedProteins[usedProteins.length - 1];
          if (lastProtein === candidate.primaryProtein && candidate.primaryProtein !== 'mixed') continue;

          selected = candidate;
          break;
        }

        // Rotate candidates to ensure variety
        const slotCandidates = mealDB[slotType] || mealDB['snack'] || [];
        const idx = slotCandidates.indexOf(selected);
        if (idx >= 0) {
          slotCandidates.push(slotCandidates.splice(idx, 1)[0]);
        }

        usedProteins.push(selected.primaryProtein);
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
          fatsecretSearchQuery: selected.searchQuery,
          suggestedServings: 1,
          primaryProtein: selected.primaryProtein,
          tags: selected.tags,
        });
      }

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
   * Returns a meal database filtered by dietary style and allergies.
   */
  private getMealDatabase(intake: ClientIntake): Record<string, MealCandidate[]> {
    const allergiesLower = new Set(intake.allergies.map((a) => a.toLowerCase()));
    const exclusionsLower = new Set(intake.exclusions.map((e) => e.toLowerCase()));

    const allMeals = this.getFullMealDatabase();

    // Filter by dietary style
    const filtered: Record<string, MealCandidate[]> = {};
    for (const [slot, meals] of Object.entries(allMeals)) {
      filtered[slot] = meals.filter((meal) => {
        // Dietary style check
        if (intake.dietaryStyle === 'vegetarian' && meal.tags.includes('meat')) return false;
        if (intake.dietaryStyle === 'vegan' && (meal.tags.includes('meat') || meal.tags.includes('dairy') || meal.tags.includes('eggs'))) return false;
        if (intake.dietaryStyle === 'pescatarian' && meal.tags.includes('meat') && !meal.tags.includes('fish')) return false;

        // Allergy/exclusion check
        for (const allergen of allergiesLower) {
          if (meal.name.toLowerCase().includes(allergen) || meal.primaryProtein.toLowerCase().includes(allergen)) return false;
        }
        for (const exclusion of exclusionsLower) {
          if (meal.name.toLowerCase().includes(exclusion) || meal.primaryProtein.toLowerCase().includes(exclusion)) return false;
        }

        return true;
      });
    }

    return filtered;
  }

  /**
   * Full meal database with realistic meals across cuisines.
   */
  private getFullMealDatabase(): Record<string, MealCandidate[]> {
    return {
      breakfast: [
        { name: 'Greek Yogurt Parfait with Berries and Granola', cuisine: 'American', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'dairy', searchQuery: 'greek yogurt parfait berries', tags: ['dairy', 'quick', 'no-cook'] },
        { name: 'Scrambled Eggs with Spinach and Whole Grain Toast', cuisine: 'American', basePrepMin: 5, baseCookMin: 10, primaryProtein: 'eggs', searchQuery: 'scrambled eggs spinach toast', tags: ['eggs', 'quick'] },
        { name: 'Overnight Oats with Banana and Almond Butter', cuisine: 'American', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'overnight oats banana almond butter', tags: ['dairy', 'no-cook', 'meal-prep'] },
        { name: 'Protein Smoothie Bowl with Mixed Berries', cuisine: 'American', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'whey', searchQuery: 'protein smoothie bowl berries', tags: ['dairy', 'quick', 'no-cook'] },
        { name: 'Avocado Toast with Poached Eggs and Cherry Tomatoes', cuisine: 'Australian', basePrepMin: 10, baseCookMin: 8, primaryProtein: 'eggs', searchQuery: 'avocado toast poached eggs', tags: ['eggs', 'quick'] },
        { name: 'Turkey Sausage Breakfast Burrito', cuisine: 'Mexican', basePrepMin: 10, baseCookMin: 15, primaryProtein: 'turkey', searchQuery: 'turkey sausage breakfast burrito', tags: ['meat', 'quick'] },
        { name: 'Whole Grain Pancakes with Fresh Blueberries', cuisine: 'American', basePrepMin: 15, baseCookMin: 15, primaryProtein: 'mixed', searchQuery: 'whole grain pancakes blueberries', tags: ['eggs', 'dairy'] },
        { name: 'Smoked Salmon Bagel with Cream Cheese', cuisine: 'American', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'salmon', searchQuery: 'smoked salmon bagel cream cheese', tags: ['fish', 'dairy', 'no-cook'] },
        { name: 'Vegetable Frittata with Bell Peppers', cuisine: 'Italian', basePrepMin: 10, baseCookMin: 20, primaryProtein: 'eggs', searchQuery: 'vegetable frittata bell peppers', tags: ['eggs', 'dairy'] },
        { name: 'Chia Pudding with Mango and Coconut', cuisine: 'Thai', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'chia pudding mango coconut', tags: ['no-cook', 'meal-prep', 'vegan-friendly'] },
      ],
      lunch: [
        { name: 'Grilled Chicken Caesar Salad', cuisine: 'Italian', basePrepMin: 15, baseCookMin: 15, primaryProtein: 'chicken', searchQuery: 'grilled chicken caesar salad', tags: ['meat', 'grill'] },
        { name: 'Turkey and Avocado Wrap with Mixed Greens', cuisine: 'American', basePrepMin: 10, baseCookMin: 0, primaryProtein: 'turkey', searchQuery: 'turkey avocado wrap', tags: ['meat', 'quick', 'no-cook'] },
        { name: 'Quinoa Power Bowl with Chickpeas and Tahini', cuisine: 'Mediterranean', basePrepMin: 15, baseCookMin: 20, primaryProtein: 'chickpeas', searchQuery: 'quinoa bowl chickpeas tahini', tags: ['vegan-friendly'] },
        { name: 'Mediterranean Grilled Chicken Bowl with Hummus', cuisine: 'Mediterranean', basePrepMin: 15, baseCookMin: 20, primaryProtein: 'chicken', searchQuery: 'mediterranean chicken bowl hummus', tags: ['meat', 'grill'] },
        { name: 'Salmon Poke Bowl with Edamame and Rice', cuisine: 'Japanese', basePrepMin: 15, baseCookMin: 5, primaryProtein: 'salmon', searchQuery: 'salmon poke bowl edamame rice', tags: ['fish', 'quick'] },
        { name: 'Southwest Black Bean and Corn Salad', cuisine: 'Mexican', basePrepMin: 15, baseCookMin: 10, primaryProtein: 'beans', searchQuery: 'southwest black bean corn salad', tags: ['vegan-friendly'] },
        { name: 'Asian Chicken Lettuce Wraps with Peanut Sauce', cuisine: 'Thai', basePrepMin: 15, baseCookMin: 15, primaryProtein: 'chicken', searchQuery: 'asian chicken lettuce wraps', tags: ['meat', 'stir-fry'] },
        { name: 'Tuna Nicoise Salad with Hard-Boiled Eggs', cuisine: 'French', basePrepMin: 20, baseCookMin: 10, primaryProtein: 'tuna', searchQuery: 'tuna nicoise salad eggs', tags: ['fish', 'eggs'] },
        { name: 'Lentil Soup with Whole Grain Bread', cuisine: 'Indian', basePrepMin: 10, baseCookMin: 30, primaryProtein: 'lentils', searchQuery: 'lentil soup bread', tags: ['vegan-friendly'] },
        { name: 'Beef and Broccoli Stir-Fry with Brown Rice', cuisine: 'Chinese', basePrepMin: 15, baseCookMin: 15, primaryProtein: 'beef', searchQuery: 'beef broccoli stir fry brown rice', tags: ['meat', 'stir-fry'] },
      ],
      dinner: [
        { name: 'Grilled Salmon with Roasted Sweet Potato and Asparagus', cuisine: 'American', basePrepMin: 15, baseCookMin: 25, primaryProtein: 'salmon', searchQuery: 'grilled salmon sweet potato asparagus', tags: ['fish', 'grill'] },
        { name: 'Chicken Stir-Fry with Brown Rice and Vegetables', cuisine: 'Chinese', basePrepMin: 15, baseCookMin: 20, primaryProtein: 'chicken', searchQuery: 'chicken stir fry brown rice vegetables', tags: ['meat', 'stir-fry'] },
        { name: 'Lean Beef Tacos with Corn Tortillas and Salsa', cuisine: 'Mexican', basePrepMin: 15, baseCookMin: 20, primaryProtein: 'beef', searchQuery: 'lean beef tacos corn tortillas', tags: ['meat'] },
        { name: 'Baked Cod with Lemon Herb Sweet Potato Mash', cuisine: 'British', basePrepMin: 15, baseCookMin: 30, primaryProtein: 'cod', searchQuery: 'baked cod lemon sweet potato', tags: ['fish', 'bake'] },
        { name: 'Turkey Meatballs with Zucchini Noodles and Marinara', cuisine: 'Italian', basePrepMin: 20, baseCookMin: 25, primaryProtein: 'turkey', searchQuery: 'turkey meatballs zucchini noodles marinara', tags: ['meat', 'bake'] },
        { name: 'Herb-Crusted Chicken Thighs with Roasted Vegetables', cuisine: 'French', basePrepMin: 15, baseCookMin: 35, primaryProtein: 'chicken', searchQuery: 'herb crusted chicken thighs roasted vegetables', tags: ['meat', 'bake'] },
        { name: 'Shrimp and Vegetable Stir-Fry with Jasmine Rice', cuisine: 'Thai', basePrepMin: 15, baseCookMin: 15, primaryProtein: 'shrimp', searchQuery: 'shrimp vegetable stir fry jasmine rice', tags: ['fish', 'stir-fry'] },
        { name: 'Pork Tenderloin with Apple Cider Glaze and Quinoa', cuisine: 'American', basePrepMin: 15, baseCookMin: 30, primaryProtein: 'pork', searchQuery: 'pork tenderloin apple cider quinoa', tags: ['meat', 'bake'] },
        { name: 'Chickpea and Spinach Curry with Basmati Rice', cuisine: 'Indian', basePrepMin: 15, baseCookMin: 25, primaryProtein: 'chickpeas', searchQuery: 'chickpea spinach curry basmati rice', tags: ['vegan-friendly'] },
        { name: 'Grilled Tofu with Teriyaki Glaze and Stir-Fried Vegetables', cuisine: 'Japanese', basePrepMin: 20, baseCookMin: 20, primaryProtein: 'tofu', searchQuery: 'grilled tofu teriyaki stir fry vegetables', tags: ['vegan-friendly', 'grill'] },
      ],
      snack: [
        { name: 'Apple Slices with Almond Butter', cuisine: 'American', basePrepMin: 5, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'apple slices almond butter', tags: ['no-cook', 'quick', 'vegan-friendly'] },
        { name: 'Protein Bar (Chocolate Peanut Butter)', cuisine: 'American', basePrepMin: 0, baseCookMin: 0, primaryProtein: 'whey', searchQuery: 'protein bar chocolate peanut butter', tags: ['dairy', 'no-cook', 'quick'] },
        { name: 'Trail Mix with Nuts and Dried Fruit', cuisine: 'American', basePrepMin: 0, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'trail mix nuts dried fruit', tags: ['no-cook', 'quick', 'vegan-friendly'] },
        { name: 'Cottage Cheese with Pineapple Chunks', cuisine: 'American', basePrepMin: 5, baseCookMin: 0, primaryProtein: 'dairy', searchQuery: 'cottage cheese pineapple', tags: ['dairy', 'no-cook', 'quick'] },
        { name: 'Rice Cakes with Peanut Butter and Banana', cuisine: 'American', basePrepMin: 5, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'rice cakes peanut butter banana', tags: ['no-cook', 'quick', 'vegan-friendly'] },
        { name: 'Hummus with Carrot and Celery Sticks', cuisine: 'Mediterranean', basePrepMin: 5, baseCookMin: 0, primaryProtein: 'chickpeas', searchQuery: 'hummus carrot celery sticks', tags: ['no-cook', 'quick', 'vegan-friendly'] },
        { name: 'Hard-Boiled Eggs with Everything Seasoning', cuisine: 'American', basePrepMin: 5, baseCookMin: 12, primaryProtein: 'eggs', searchQuery: 'hard boiled eggs seasoning', tags: ['eggs', 'meal-prep'] },
        { name: 'Greek Yogurt with Honey and Walnuts', cuisine: 'Greek', basePrepMin: 5, baseCookMin: 0, primaryProtein: 'dairy', searchQuery: 'greek yogurt honey walnuts', tags: ['dairy', 'no-cook', 'quick'] },
        { name: 'Edamame with Sea Salt', cuisine: 'Japanese', basePrepMin: 2, baseCookMin: 5, primaryProtein: 'soy', searchQuery: 'edamame sea salt', tags: ['vegan-friendly', 'quick'] },
        { name: 'Dark Chocolate Almonds (30g)', cuisine: 'American', basePrepMin: 0, baseCookMin: 0, primaryProtein: 'mixed', searchQuery: 'dark chocolate almonds', tags: ['no-cook', 'quick'] },
      ],
      // Additional slot mappings
      morning_snack: [],
      afternoon_snack: [],
      evening_snack: [],
    };
  }
}

/**
 * Internal type for meal candidates in the deterministic generator
 */
interface MealCandidate {
  name: string;
  cuisine: string;
  basePrepMin: number;
  baseCookMin: number;
  primaryProtein: string;
  searchQuery: string;
  tags: string[];
}
