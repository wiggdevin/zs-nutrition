import {
  ClientIntake,
  MetabolicProfile,
  MealPlanDraft,
  MealPlanDraftSchema,
  DraftMeal,
  DraftDay,
} from '../types/schemas';

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

  async generate(metabolicProfile: MetabolicProfile, intake: ClientIntake): Promise<MealPlanDraft> {
    // Attempt Claude-based generation if API key is available
    if (
      this.anthropicApiKey &&
      this.anthropicApiKey !== '' &&
      !this.anthropicApiKey.includes('YOUR_KEY')
    ) {
      try {
        return await this.generateWithClaude(metabolicProfile, intake);
      } catch (error) {
        console.warn(
          '[RecipeCurator] Claude generation failed, falling back to deterministic:',
          error instanceof Error ? error.message : 'Unknown error'
        );
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
5. IMPORTANT: Prioritize meals from the client's cuisine preferences (${intake.cuisinePreferences.length > 0 ? intake.cuisinePreferences.join(', ') : 'Any'}) - aim for at least 60-70% of meals from these cuisines while still maintaining variety

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
          "targetNutrition": { "kcal": 500, "proteinG": 35, "carbsG": 40, "fatG": 18 },
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
Training days: ${dayNames.filter((_, i) => trainingDaysSet.has(dayNames[i].toLowerCase() as (typeof intake.trainingDays)[number])).join(', ')}.
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

    const dayNames: Array<
      'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    > = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Map JS getDay() (0=Sunday, 1=Monday, etc.) to our dayNames array
    const jsDayToName: Array<
      'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    > = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const trainingDaysSet = new Set(intake.trainingDays);

    // Meal database organized by slot and cuisine
    const mealDB = this.getMealDatabase(intake);

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

        let selected = null;

        // Strategy: Try preferred cuisines 75% of the time to ensure >50% overall preference
        // while still allowing enough variety from other cuisines
        const usePreferred = slotData.preferred.length > 0 && Math.random() < 0.75;

        if (usePreferred) {
          // Try preferred cuisines (with relaxed variety check)
          for (const candidate of slotData.preferred) {
            // Track meals by days: ~mealsPerDay * (days window + 1)
            // Preferred: 1 day window (current day + 1 previous = 2 days)
            const mealsPerDay = intake.mealsPerDay + intake.snacksPerDay;
            const recentPreferredMeals = recentMealNames.slice(-(mealsPerDay * 2));
            if (recentPreferredMeals.includes(candidate.name)) {
              continue;
            }

            // Check if this protein was used on the previous day (enforce consecutive-day rule)
            // Allow certain proteins to repeat: mixed, dairy, eggs, plant-based proteins
            const exemptProteins = [
              'mixed',
              'dairy',
              'eggs',
              'whey',
              'tofu',
              'beans',
              'chickpeas',
              'lentils',
              'soy',
            ];
            const candidateProteinLower = candidate.primaryProtein.toLowerCase();
            const isExempt = exemptProteins.some((e) =>
              candidateProteinLower === e || candidateProteinLower.includes(e) || e.includes(candidateProteinLower)
            );

            // Check if this protein (or a related protein) was used yesterday
            const wasUsedYesterday = previousDayProteins.some((prevProtein) =>
              prevProtein === candidateProteinLower ||
              prevProtein.includes(candidateProteinLower) ||
              candidateProteinLower.includes(prevProtein)
            );

            if (wasUsedYesterday && !isExempt) {
              continue;
            }

            selected = candidate;
            break;
          }
        }

        // If no suitable preferred meal (or we're using other pool), try other cuisines
        if (!selected && slotData.other.length > 0) {
          for (const candidate of slotData.other) {
            // Track meals by days: ~mealsPerDay * (days window + 1)
            // Other: 3 day window (current day + 3 previous = 4 days)
            const mealsPerDay = intake.mealsPerDay + intake.snacksPerDay;
            const recentOtherMeals = recentMealNames.slice(-(mealsPerDay * 4));
            if (recentOtherMeals.includes(candidate.name)) {
              continue;
            }

            // Check if this protein was used on the previous day (enforce consecutive-day rule)
            const exemptProteins = [
              'mixed',
              'dairy',
              'eggs',
              'whey',
              'tofu',
              'beans',
              'chickpeas',
              'lentils',
              'soy',
            ];
            const candidateProteinLower = candidate.primaryProtein.toLowerCase();
            const isExempt = exemptProteins.some((e) =>
              candidateProteinLower === e || candidateProteinLower.includes(e) || e.includes(candidateProteinLower)
            );
            const wasUsedYesterday = previousDayProteins.some((prevProtein) =>
              prevProtein === candidateProteinLower ||
              prevProtein.includes(candidateProteinLower) ||
              candidateProteinLower.includes(prevProtein)
            );

            if (wasUsedYesterday && !isExempt) {
              continue;
            }

            selected = candidate;
            break;
          }
        }

        // Ultimate fallback: pick first available meal that doesn't violate consecutive protein rule
        if (!selected) {
          const exemptProteins = [
            'mixed',
            'dairy',
            'eggs',
            'whey',
            'tofu',
            'beans',
            'chickpeas',
            'lentils',
            'soy',
          ];

          // Helper function to check if protein was used yesterday (with fuzzy matching)
          const wasProteinUsedYesterday = (protein: string): boolean => {
            const proteinLower = protein.toLowerCase();
            return previousDayProteins.some((prevProtein) =>
              prevProtein === proteinLower ||
              prevProtein.includes(proteinLower) ||
              proteinLower.includes(prevProtein)
            );
          };

          // Helper function to check if protein is exempt
          const isProteinExempt = (protein: string): boolean => {
            const proteinLower = protein.toLowerCase();
            return exemptProteins.some((e) =>
              proteinLower === e || proteinLower.includes(e) || e.includes(proteinLower)
            );
          };

          // Try to find any meal in preferred that doesn't violate consecutive protein rule
          for (const candidate of slotData.preferred) {
            const isExempt = isProteinExempt(candidate.primaryProtein);
            const wasUsedYesterday = wasProteinUsedYesterday(candidate.primaryProtein);
            if (!wasUsedYesterday || isExempt) {
              selected = candidate;
              break;
            }
          }

          // If still not found, try other pool
          if (!selected) {
            for (const candidate of slotData.other) {
              const isExempt = isProteinExempt(candidate.primaryProtein);
              const wasUsedYesterday = wasProteinUsedYesterday(candidate.primaryProtein);
              if (!wasUsedYesterday || isExempt) {
                selected = candidate;
                break;
              }
            }
          }

          // Absolute last resort: pick first available even if it violates the rule
          // (better to have a plan than to fail completely)
          if (!selected) {
            selected = slotData.preferred[0] || slotData.other[0];
          }
        }

        // Rotate the selected meal in its pool to ensure variety
        const pool = slotData.preferred.includes(selected) ? slotData.preferred : slotData.other;
        const idx = pool.indexOf(selected);
        if (idx >= 0) {
          pool.push(pool.splice(idx, 1)[0]);
        }

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
  private getMealDatabase(
    intake: ClientIntake
  ): Record<string, { preferred: MealCandidate[]; other: MealCandidate[] }> {
    const allergiesLower = new Set(intake.allergies.map((a) => a.toLowerCase()));
    const exclusionsLower = new Set(intake.exclusions.map((e) => e.toLowerCase()));
    const preferredCuisines = new Set(intake.cuisinePreferences.map((c) => c.toLowerCase()));

    // Determine allowed complexity levels based on cooking skill
    const allowedComplexities: Set<'simple' | 'moderate' | 'complex'> = new Set();
    if (intake.cookingSkill <= 3) {
      // Beginner: only simple recipes
      allowedComplexities.add('simple');
    } else if (intake.cookingSkill <= 6) {
      // Intermediate: simple + moderate recipes
      allowedComplexities.add('simple');
      allowedComplexities.add('moderate');
    } else {
      // Advanced: all complexity levels
      allowedComplexities.add('simple');
      allowedComplexities.add('moderate');
      allowedComplexities.add('complex');
    }

    const allMeals = this.getFullMealDatabase();

    // Filter by dietary style, complexity, and cuisine preferences
    const filtered: Record<string, { preferred: MealCandidate[]; other: MealCandidate[] }> = {};
    for (const [slot, meals] of Object.entries(allMeals)) {
      const preferred: MealCandidate[] = [];
      const other: MealCandidate[] = [];

      for (const meal of meals) {
        // Complexity check - filter based on cooking skill
        if (!allowedComplexities.has(meal.complexity)) {
          continue;
        }

        // Dietary style check
        let passesDietaryStyle = true;
        switch (intake.dietaryStyle) {
          case 'vegetarian':
            // No meat/poultry/fish, but eggs/dairy allowed
            if (meal.tags.includes('meat') || meal.tags.includes('fish')) {
              passesDietaryStyle = false;
            }
            break;

          case 'vegan':
            // No meat, fish, eggs, dairy, or other animal products
            if (
              meal.tags.includes('meat') ||
              meal.tags.includes('fish') ||
              meal.tags.includes('eggs') ||
              meal.tags.includes('dairy')
            ) {
              passesDietaryStyle = false;
            }
            break;

          case 'pescatarian':
            // No meat/poultry, but fish/eggs/dairy allowed
            if (meal.tags.includes('meat')) {
              passesDietaryStyle = false;
            }
            break;

          case 'keto':
            // Very low carb, high fat meals only
            if (!meal.tags.includes('keto')) {
              passesDietaryStyle = false;
            }
            break;

          case 'paleo':
            // No grains, dairy, legumes
            if (
              meal.tags.includes('grains') ||
              meal.tags.includes('dairy') ||
              meal.tags.includes('legumes')
            ) {
              passesDietaryStyle = false;
            }
            break;

          case 'omnivore':
          default:
            // No restrictions
            break;
        }

        if (!passesDietaryStyle) {
          continue;
        }

        // Allergy/exclusion check
        let passesAllergies = true;
        for (const allergen of allergiesLower) {
          if (
            meal.name.toLowerCase().includes(allergen) ||
            meal.primaryProtein.toLowerCase().includes(allergen)
          ) {
            passesAllergies = false;
            break;
          }
        }
        if (!passesAllergies) {
          continue;
        }

        for (const exclusion of exclusionsLower) {
          if (
            meal.name.toLowerCase().includes(exclusion) ||
            meal.primaryProtein.toLowerCase().includes(exclusion)
          ) {
            passesAllergies = false;
            break;
          }
        }
        if (!passesAllergies) {
          continue;
        }

        // Categorize by cuisine preference
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
   * Full meal database with realistic meals across cuisines.
   */
  private getFullMealDatabase(): Record<string, MealCandidate[]> {
    return {
      breakfast: [
        {
          name: 'Greek Yogurt Parfait with Berries and Granola',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'greek yogurt parfait berries',
          tags: ['dairy', 'quick', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Scrambled Eggs with Spinach and Whole Grain Toast',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 10,
          primaryProtein: 'eggs',
          searchQuery: 'scrambled eggs spinach toast',
          tags: ['eggs', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Overnight Oats with Banana and Almond Butter',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'overnight oats banana almond butter',
          tags: ['dairy', 'no-cook', 'meal-prep'],
          complexity: 'simple',
        },
        {
          name: 'Protein Smoothie Bowl with Mixed Berries',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'whey',
          searchQuery: 'protein smoothie bowl berries',
          tags: ['dairy', 'quick', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Avocado Toast with Poached Eggs and Cherry Tomatoes',
          cuisine: 'Australian',
          basePrepMin: 10,
          baseCookMin: 8,
          primaryProtein: 'eggs',
          searchQuery: 'avocado toast poached eggs',
          tags: ['eggs', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Turkey Sausage Breakfast Burrito',
          cuisine: 'Mexican',
          basePrepMin: 10,
          baseCookMin: 15,
          primaryProtein: 'turkey',
          searchQuery: 'turkey sausage breakfast burrito',
          tags: ['meat', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Whole Grain Pancakes with Fresh Blueberries',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'mixed',
          searchQuery: 'whole grain pancakes blueberries',
          tags: ['eggs', 'dairy'],
          complexity: 'moderate',
        },
        {
          name: 'Smoked Salmon Bagel with Cream Cheese',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'salmon',
          searchQuery: 'smoked salmon bagel cream cheese',
          tags: ['fish', 'dairy', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Vegetable Frittata with Bell Peppers',
          cuisine: 'Italian',
          basePrepMin: 10,
          baseCookMin: 20,
          primaryProtein: 'eggs',
          searchQuery: 'vegetable frittata bell peppers',
          tags: ['eggs', 'dairy'],
          complexity: 'moderate',
        },
        {
          name: 'Miso Soup with Tofu and Seaweed',
          cuisine: 'Japanese',
          basePrepMin: 5,
          baseCookMin: 10,
          primaryProtein: 'tofu',
          searchQuery: 'miso soup tofu seaweed',
          tags: ['vegan-friendly', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Japanese Rice Bowl with Natto and Egg',
          cuisine: 'Japanese',
          basePrepMin: 5,
          baseCookMin: 5,
          primaryProtein: 'mixed',
          searchQuery: 'japanese rice natto egg',
          tags: ['quick', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Italian Bruschetta with Tomato and Basil',
          cuisine: 'Italian',
          basePrepMin: 10,
          baseCookMin: 5,
          primaryProtein: 'mixed',
          searchQuery: 'bruschetta tomato basil',
          tags: ['vegan-friendly', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Chia Pudding with Mango and Coconut',
          cuisine: 'Thai',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'chia pudding mango coconut',
          tags: ['no-cook', 'meal-prep', 'vegan-friendly'],
          complexity: 'simple',
        },
        // Keto options
        {
          name: 'Bacon and Eggs with Avocado',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 15,
          primaryProtein: 'eggs',
          searchQuery: 'bacon eggs avocado',
          tags: ['keto', 'eggs', 'high-fat'],
          complexity: 'simple',
        },
        {
          name: 'Scrambled Eggs with Cheese and Heavy Cream',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 10,
          primaryProtein: 'eggs',
          searchQuery: 'scrambled eggs cheese heavy cream',
          tags: ['keto', 'eggs', 'dairy', 'high-fat'],
          complexity: 'simple',
        },
        {
          name: 'Keto Smoothie with Avocado and Coconut Milk',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'keto smoothie avocado coconut milk',
          tags: ['keto', 'high-fat', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Smoked Salmon with Cream Cheese',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'salmon',
          searchQuery: 'smoked salmon cream cheese',
          tags: ['keto', 'fish', 'dairy', 'high-fat', 'no-cook'],
          complexity: 'simple',
        },
        // Paleo options
        {
          name: 'Sweet Potato with Almond Butter and Berries',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'sweet potato almond butter berries',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Scrambled Eggs with Avocado and Tomato',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 10,
          primaryProtein: 'eggs',
          searchQuery: 'scrambled eggs avocado tomato',
          tags: ['paleo', 'grain-free', 'no-dairy'],
          complexity: 'simple',
        },
        {
          name: 'Coconut Chia Pudding with Berries',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'coconut chia pudding berries',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'meal-prep'],
          complexity: 'simple',
        },
      ],
      lunch: [
        {
          name: 'Grilled Chicken Caesar Salad',
          cuisine: 'Italian',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'chicken',
          searchQuery: 'grilled chicken caesar salad',
          tags: ['meat', 'grill'],
          complexity: 'moderate',
        },
        {
          name: 'Italian Caprese Sandwich with Mozzarella and Tomato',
          cuisine: 'Italian',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'caprese sandwich mozzarella tomato',
          tags: ['dairy', 'quick', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Minestrone Soup with Pasta and Vegetables',
          cuisine: 'Italian',
          basePrepMin: 10,
          baseCookMin: 25,
          primaryProtein: 'mixed',
          searchQuery: 'minestrone soup pasta vegetables',
          tags: ['vegan-friendly'],
          complexity: 'moderate',
        },
        {
          name: 'Chicken Katsu Curry Rice Bowl',
          cuisine: 'Japanese',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'chicken katsu curry rice',
          tags: ['meat'],
          complexity: 'moderate',
        },
        {
          name: 'Beef Teriyaki Bowl with Rice and Vegetables',
          cuisine: 'Japanese',
          basePrepMin: 10,
          baseCookMin: 15,
          primaryProtein: 'beef',
          searchQuery: 'beef teriyaki bowl rice vegetables',
          tags: ['meat', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Turkey and Avocado Wrap with Mixed Greens',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'turkey',
          searchQuery: 'turkey avocado wrap',
          tags: ['meat', 'quick', 'no-cook'],
          complexity: 'simple',
        },
        {
          name: 'Quinoa Power Bowl with Chickpeas and Tahini',
          cuisine: 'Mediterranean',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chickpeas',
          searchQuery: 'quinoa bowl chickpeas tahini',
          tags: ['vegan-friendly'],
          complexity: 'moderate',
        },
        {
          name: 'Mediterranean Grilled Chicken Bowl with Hummus',
          cuisine: 'Mediterranean',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'mediterranean chicken bowl hummus',
          tags: ['meat', 'grill'],
          complexity: 'moderate',
        },
        {
          name: 'Salmon Poke Bowl with Edamame and Rice',
          cuisine: 'Japanese',
          basePrepMin: 15,
          baseCookMin: 5,
          primaryProtein: 'salmon',
          searchQuery: 'salmon poke bowl edamame rice',
          tags: ['fish', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Southwest Black Bean and Corn Salad',
          cuisine: 'Mexican',
          basePrepMin: 15,
          baseCookMin: 10,
          primaryProtein: 'beans',
          searchQuery: 'southwest black bean corn salad',
          tags: ['vegan-friendly'],
          complexity: 'moderate',
        },
        {
          name: 'Asian Chicken Lettuce Wraps with Peanut Sauce',
          cuisine: 'Thai',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'chicken',
          searchQuery: 'asian chicken lettuce wraps',
          tags: ['meat', 'stir-fry'],
          complexity: 'moderate',
        },
        {
          name: 'Tuna Nicoise Salad with Hard-Boiled Eggs',
          cuisine: 'French',
          basePrepMin: 20,
          baseCookMin: 10,
          primaryProtein: 'tuna',
          searchQuery: 'tuna nicoise salad eggs',
          tags: ['fish', 'eggs'],
          complexity: 'moderate',
        },
        {
          name: 'Lentil Soup with Whole Grain Bread',
          cuisine: 'Indian',
          basePrepMin: 10,
          baseCookMin: 30,
          primaryProtein: 'lentils',
          searchQuery: 'lentil soup bread',
          tags: ['vegan-friendly'],
          complexity: 'complex',
        },
        {
          name: 'Beef and Broccoli Stir-Fry with Brown Rice',
          cuisine: 'Chinese',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'beef',
          searchQuery: 'beef broccoli stir fry brown rice',
          tags: ['meat', 'stir-fry'],
          complexity: 'moderate',
        },
        // Keto options
        {
          name: 'Cobb Salad with Bacon, Avocado, and Blue Cheese',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 10,
          primaryProtein: 'mixed',
          searchQuery: 'cobb salad bacon avocado blue cheese',
          tags: ['keto', 'eggs', 'dairy', 'high-fat'],
          complexity: 'moderate',
        },
        {
          name: 'Grilled Chicken with Garlic Butter and Asparagus',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'grilled chicken garlic butter asparagus',
          tags: ['keto', 'meat', 'high-fat', 'grill'],
          complexity: 'moderate',
        },
        {
          name: 'Salmon with Lemon Butter and Spinach',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 20,
          primaryProtein: 'salmon',
          searchQuery: 'salmon lemon butter spinach',
          tags: ['keto', 'fish', 'high-fat'],
          complexity: 'moderate',
        },
        {
          name: 'Zucchini Noodles with Pesto and Grilled Chicken',
          cuisine: 'Italian',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'chicken',
          searchQuery: 'zucchini noodles pesto grilled chicken',
          tags: ['keto', 'meat', 'grain-free'],
          complexity: 'moderate',
        },
        {
          name: 'Steak Salad with Blue Cheese Dressing',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'beef',
          searchQuery: 'steak salad blue cheese dressing',
          tags: ['keto', 'meat', 'dairy', 'high-fat'],
          complexity: 'moderate',
        },
        // Paleo options
        {
          name: 'Grilled Chicken with Roasted Sweet Potato and Broccoli',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 25,
          primaryProtein: 'chicken',
          searchQuery: 'grilled chicken roasted sweet potato broccoli',
          tags: ['paleo', 'grain-free', 'no-dairy', 'grill'],
          complexity: 'complex',
        },
        {
          name: 'Salmon with Asparagus and Sweet Potato',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 20,
          primaryProtein: 'salmon',
          searchQuery: 'salmon asparagus sweet potato',
          tags: ['paleo', 'grain-free', 'no-dairy', 'fish'],
          complexity: 'moderate',
        },
        {
          name: 'Steak Salad with Avocado and Tomato',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'beef',
          searchQuery: 'steak salad avocado tomato',
          tags: ['paleo', 'grain-free', 'no-dairy'],
          complexity: 'moderate',
        },
        {
          name: 'Chicken and Vegetable Stir-Fry with Cauliflower Rice',
          cuisine: 'Chinese',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'chicken',
          searchQuery: 'chicken vegetable stir fry cauliflower rice',
          tags: ['paleo', 'grain-free', 'no-dairy', 'stir-fry'],
          complexity: 'moderate',
        },
      ],
      dinner: [
        {
          name: 'Grilled Salmon with Roasted Sweet Potato and Asparagus',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 25,
          primaryProtein: 'salmon',
          searchQuery: 'grilled salmon sweet potato asparagus',
          tags: ['fish', 'grill'],
          complexity: 'complex',
        },
        {
          name: 'Chicken Stir-Fry with Brown Rice and Vegetables',
          cuisine: 'Chinese',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'chicken stir fry brown rice vegetables',
          tags: ['meat', 'stir-fry'],
          complexity: 'moderate',
        },
        {
          name: 'Lean Beef Tacos with Corn Tortillas and Salsa',
          cuisine: 'Mexican',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'beef',
          searchQuery: 'lean beef tacos corn tortillas',
          tags: ['meat'],
          complexity: 'moderate',
        },
        {
          name: 'Baked Cod with Lemon Herb Sweet Potato Mash',
          cuisine: 'British',
          basePrepMin: 15,
          baseCookMin: 30,
          primaryProtein: 'cod',
          searchQuery: 'baked cod lemon sweet potato',
          tags: ['fish', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Turkey Meatballs with Zucchini Noodles and Marinara',
          cuisine: 'Italian',
          basePrepMin: 20,
          baseCookMin: 25,
          primaryProtein: 'turkey',
          searchQuery: 'turkey meatballs zucchini noodles marinara',
          tags: ['meat', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Herb-Crusted Chicken Thighs with Roasted Vegetables',
          cuisine: 'French',
          basePrepMin: 15,
          baseCookMin: 35,
          primaryProtein: 'chicken',
          searchQuery: 'herb crusted chicken thighs roasted vegetables',
          tags: ['meat', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Shrimp and Vegetable Stir-Fry with Jasmine Rice',
          cuisine: 'Thai',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'shrimp',
          searchQuery: 'shrimp vegetable stir fry jasmine rice',
          tags: ['fish', 'stir-fry'],
          complexity: 'moderate',
        },
        {
          name: 'Pork Tenderloin with Apple Cider Glaze and Quinoa',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 30,
          primaryProtein: 'pork',
          searchQuery: 'pork tenderloin apple cider quinoa',
          tags: ['meat', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Chickpea and Spinach Curry with Basmati Rice',
          cuisine: 'Indian',
          basePrepMin: 15,
          baseCookMin: 25,
          primaryProtein: 'chickpeas',
          searchQuery: 'chickpea spinach curry basmati rice',
          tags: ['vegan-friendly'],
          complexity: 'complex',
        },
        {
          name: 'Grilled Tofu with Teriyaki Glaze and Stir-Fried Vegetables',
          cuisine: 'Japanese',
          basePrepMin: 20,
          baseCookMin: 20,
          primaryProtein: 'tofu',
          searchQuery: 'grilled tofu teriyaki stir fry vegetables',
          tags: ['vegan-friendly', 'grill'],
          complexity: 'complex',
        },
        {
          name: 'Eggplant Parmigiana with Whole Wheat Pasta',
          cuisine: 'Italian',
          basePrepMin: 20,
          baseCookMin: 40,
          primaryProtein: 'mixed',
          searchQuery: 'eggplant parmigiana whole wheat pasta',
          tags: ['vegetarian'],
          complexity: 'complex',
        },
        {
          name: 'Japanese Chicken Teriyaki with Steamed Rice',
          cuisine: 'Japanese',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'chicken teriyaki steamed rice',
          tags: ['meat', 'quick'],
          complexity: 'moderate',
        },
        {
          name: 'Spaghetti Bolognese with Lean Beef',
          cuisine: 'Italian',
          basePrepMin: 15,
          baseCookMin: 30,
          primaryProtein: 'beef',
          searchQuery: 'spaghetti bolognese lean beef',
          tags: ['meat'],
          complexity: 'complex',
        },
        {
          name: 'Salmon Teriyaki with Soba Noodles',
          cuisine: 'Japanese',
          basePrepMin: 15,
          baseCookMin: 15,
          primaryProtein: 'salmon',
          searchQuery: 'salmon teriyaki soba noodles',
          tags: ['fish', 'quick'],
          complexity: 'moderate',
        },
        // Keto options
        {
          name: 'Pan-Seared Steak with Garlic Butter',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 20,
          primaryProtein: 'beef',
          searchQuery: 'pan seared steak garlic butter',
          tags: ['keto', 'meat', 'high-fat'],
          complexity: 'moderate',
        },
        {
          name: 'Baked Salmon with Cream Cheese Spinach',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 25,
          primaryProtein: 'salmon',
          searchQuery: 'baked salmon cream cheese spinach',
          tags: ['keto', 'fish', 'dairy', 'high-fat', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Chicken Thighs with Skin and Roasted Vegetables',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 40,
          primaryProtein: 'chicken',
          searchQuery: 'chicken thighs skin roasted vegetables',
          tags: ['keto', 'meat', 'high-fat', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Shrimp with Zucchini Noodles in Alfredo Sauce',
          cuisine: 'Italian',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'shrimp',
          searchQuery: 'shrimp zucchini noodles alfredo sauce',
          tags: ['keto', 'fish', 'dairy', 'high-fat'],
          complexity: 'moderate',
        },
        // Paleo options
        {
          name: 'Grilled Steak with Roasted Vegetables',
          cuisine: 'American',
          basePrepMin: 10,
          baseCookMin: 25,
          primaryProtein: 'beef',
          searchQuery: 'grilled steak roasted vegetables',
          tags: ['paleo', 'grain-free', 'no-dairy', 'grill'],
          complexity: 'complex',
        },
        {
          name: 'Baked Salmon with Lemon and Asparagus',
          cuisine: 'American',
          basePrepMin: 15,
          baseCookMin: 25,
          primaryProtein: 'salmon',
          searchQuery: 'baked salmon lemon asparagus',
          tags: ['paleo', 'grain-free', 'no-dairy', 'fish', 'bake'],
          complexity: 'complex',
        },
        {
          name: 'Chicken Stir-Fry with Cauliflower Rice',
          cuisine: 'Chinese',
          basePrepMin: 15,
          baseCookMin: 20,
          primaryProtein: 'chicken',
          searchQuery: 'chicken stir fry cauliflower rice',
          tags: ['paleo', 'grain-free', 'no-dairy', 'stir-fry'],
          complexity: 'moderate',
        },
      ],
      snack: [
        {
          name: 'Apple Slices with Almond Butter',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'apple slices almond butter',
          tags: ['no-cook', 'quick', 'vegan-friendly'],
          complexity: 'simple',
        },
        {
          name: 'Protein Bar (Chocolate Peanut Butter)',
          cuisine: 'American',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'whey',
          searchQuery: 'protein bar chocolate peanut butter',
          tags: ['dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Trail Mix with Nuts and Dried Fruit',
          cuisine: 'American',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'trail mix nuts dried fruit',
          tags: ['no-cook', 'quick', 'vegan-friendly'],
          complexity: 'simple',
        },
        {
          name: 'Cottage Cheese with Pineapple Chunks',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'cottage cheese pineapple',
          tags: ['dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Rice Cakes with Peanut Butter and Banana',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'rice cakes peanut butter banana',
          tags: ['no-cook', 'quick', 'vegan-friendly'],
          complexity: 'simple',
        },
        {
          name: 'Hummus with Carrot and Celery Sticks',
          cuisine: 'Mediterranean',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'chickpeas',
          searchQuery: 'hummus carrot celery sticks',
          tags: ['no-cook', 'quick', 'vegan-friendly'],
          complexity: 'simple',
        },
        {
          name: 'Hard-Boiled Eggs with Everything Seasoning',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 12,
          primaryProtein: 'eggs',
          searchQuery: 'hard boiled eggs seasoning',
          tags: ['eggs', 'meal-prep'],
          complexity: 'moderate',
        },
        {
          name: 'Greek Yogurt with Honey and Walnuts',
          cuisine: 'Greek',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'greek yogurt honey walnuts',
          tags: ['dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Edamame with Sea Salt',
          cuisine: 'Japanese',
          basePrepMin: 2,
          baseCookMin: 5,
          primaryProtein: 'soy',
          searchQuery: 'edamame sea salt',
          tags: ['vegan-friendly', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Rice Crackers with Nori and Sesame',
          cuisine: 'Japanese',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'rice crackers nori sesame',
          tags: ['no-cook', 'quick', 'vegan-friendly'],
          complexity: 'simple',
        },
        {
          name: 'Italian Mozzarella and Tomato Skewers',
          cuisine: 'Italian',
          basePrepMin: 10,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'mozzarella tomato skewers',
          tags: ['dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Dark Chocolate Almonds (30g)',
          cuisine: 'American',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'dark chocolate almonds',
          tags: ['no-cook', 'quick'],
          complexity: 'simple',
        },
        // Keto options
        {
          name: 'Cheese and Nuts',
          cuisine: 'American',
          basePrepMin: 2,
          baseCookMin: 0,
          primaryProtein: 'dairy',
          searchQuery: 'cheese nuts',
          tags: ['keto', 'dairy', 'high-fat', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Avocado with Everything Bagel Seasoning',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'avocado everything bagel seasoning',
          tags: ['keto', 'high-fat', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Hard-Boiled Eggs with Mayonnaise',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 12,
          primaryProtein: 'eggs',
          searchQuery: 'hard boiled eggs mayonnaise',
          tags: ['keto', 'eggs', 'high-fat', 'meal-prep'],
          complexity: 'moderate',
        },
        {
          name: 'Pork Rinds with Guacamole',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'pork',
          searchQuery: 'pork rinds guacamole',
          tags: ['keto', 'meat', 'high-fat', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        // Paleo options
        {
          name: 'Mixed Nuts and Seeds',
          cuisine: 'American',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'mixed nuts seeds',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Apple Slices with Cashew Butter',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'apple slices cashew butter',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Beef Jerky',
          cuisine: 'American',
          basePrepMin: 0,
          baseCookMin: 0,
          primaryProtein: 'beef',
          searchQuery: 'beef jerky',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
        {
          name: 'Carrot Sticks with Almond Butter',
          cuisine: 'American',
          basePrepMin: 5,
          baseCookMin: 0,
          primaryProtein: 'mixed',
          searchQuery: 'carrot sticks almond butter',
          tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
          complexity: 'simple',
        },
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
  complexity: 'simple' | 'moderate' | 'complex';
}
