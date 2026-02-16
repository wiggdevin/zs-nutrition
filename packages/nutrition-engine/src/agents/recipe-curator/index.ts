import {
  ClientIntake,
  MetabolicProfile,
  MealPlanDraft,
  MealPlanDraftSchema,
} from '../../types/schemas';
import { withRetry } from '../../utils/retry';
import { estimateTokens, MAX_PROMPT_TOKENS } from '../../utils/token-estimate';
import { engineLogger } from '../../utils/logger';
import { generateDeterministic } from './meal-generator';

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
    return generateDeterministic(metabolicProfile, intake);
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
}
