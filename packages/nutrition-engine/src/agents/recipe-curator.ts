import {
  ClientIntake,
  MetabolicProfile,
  MealPlanDraft,
  MealPlanDraftSchema,
  DraftMeal,
  DraftDay,
} from '../types/schemas';
import { withRetry } from '../utils/retry';
import { estimateTokens, MAX_PROMPT_TOKENS } from '../utils/token-estimate';
import { engineLogger } from '../utils/logger';
import { MEAL_DATABASE, MealCandidate } from '../data/meal-database';

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
        return await withRetry(() => this.generateWithClaude(metabolicProfile, intake), {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 15000,
        });
      } catch (error) {
        engineLogger.warn(
          '[RecipeCurator] Claude generation failed after retries, falling back to deterministic:',
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
    let prompt = this.buildPrompt(metabolicProfile, intake);

    const estimatedTokens = estimateTokens(prompt);
    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      engineLogger.warn(
        `[RecipeCurator] Prompt exceeds token limit (${estimatedTokens} estimated vs ${MAX_PROMPT_TOKENS} max), truncating`
      );
      prompt = prompt.slice(0, MAX_PROMPT_TOKENS * 4);
    }

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
            const isExempt = exemptProteins.some(
              (e) =>
                candidateProteinLower === e ||
                candidateProteinLower.includes(e) ||
                e.includes(candidateProteinLower)
            );

            // Check if this protein (or a related protein) was used yesterday
            const wasUsedYesterday = previousDayProteins.some(
              (prevProtein) =>
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
            const isExempt = exemptProteins.some(
              (e) =>
                candidateProteinLower === e ||
                candidateProteinLower.includes(e) ||
                e.includes(candidateProteinLower)
            );
            const wasUsedYesterday = previousDayProteins.some(
              (prevProtein) =>
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
            return previousDayProteins.some(
              (prevProtein) =>
                prevProtein === proteinLower ||
                prevProtein.includes(proteinLower) ||
                proteinLower.includes(prevProtein)
            );
          };

          // Helper function to check if protein is exempt
          const isProteinExempt = (protein: string): boolean => {
            const proteinLower = protein.toLowerCase();
            return exemptProteins.some(
              (e) => proteinLower === e || proteinLower.includes(e) || e.includes(proteinLower)
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

    // Filter by dietary style, complexity, and cuisine preferences
    const filtered: Record<string, { preferred: MealCandidate[]; other: MealCandidate[] }> = {};
    for (const [slot, meals] of Object.entries(MEAL_DATABASE)) {
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
}
