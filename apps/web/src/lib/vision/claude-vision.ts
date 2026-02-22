/**
 * Claude Vision Integration for Food Photo Analysis
 *
 * This module uses Anthropic's Claude API to analyze food photos
 * and estimate nutritional content.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/safe-logger';
import { getConfig } from '@zero-sum/nutrition-engine';

// Nutrition analysis result structure
export interface NutritionEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
}

export interface DetectedIngredient {
  name: string;
  amount: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface FoodAnalysisResult {
  meal_name: string;
  description: string;
  ingredients: DetectedIngredient[];
  estimated_nutrition: NutritionEstimate;
  portion_size_estimate: string;
  confidence_score: number; // 0-100
  warnings?: string[];
}

export interface VisionAnalysisOptions {
  maxRetries?: number;
  timeout?: number;
}

const VISION_NUTRITION_BOUNDS = {
  calories: { min: 5, max: 5000 },
  protein_g: { min: 0, max: 300 },
  carbs_g: { min: 0, max: 500 },
  fat_g: { min: 0, max: 300 },
  fiber_g: { min: 0, max: 100 },
} as const;

function clampNutrition(value: number, field: keyof typeof VISION_NUTRITION_BOUNDS): number {
  const bounds = VISION_NUTRITION_BOUNDS[field];
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

/**
 * Claude Vision client for food photo analysis
 */
export class ClaudeVisionClient {
  private client: Anthropic | null = null;
  private readonly model = getConfig('vision').model;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      logger.warn('ANTHROPIC_API_KEY not found - Vision analysis will not work');
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey,
        timeout: 60000, // 60 second timeout
      });
    } catch (error) {
      logger.error('Failed to initialize Claude Vision client:', error);
    }
  }

  /**
   * Check if the client is properly initialized
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Analyze a food photo and estimate nutritional content
   *
   * @param imageUrl - URL to the food photo (can be base64 data URL)
   * @param options - Optional configuration
   * @returns Food analysis result with nutrition estimates
   */
  async analyzeFoodPhoto(
    imageUrl: string,
    options: VisionAnalysisOptions = {}
  ): Promise<FoodAnalysisResult> {
    if (!this.client) {
      throw new Error('Claude Vision client not initialized. Check ANTHROPIC_API_KEY.');
    }

    const { maxRetries = 2 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performAnalysis(imageUrl);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff before retry
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError || new Error('Failed to analyze food photo');
  }

  /**
   * Perform the actual vision analysis
   */
  private async performAnalysis(imageUrl: string): Promise<FoodAnalysisResult> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const prompt = this.buildAnalysisPrompt();

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: [
        {
          type: 'text' as const,
          text: 'You are an expert nutritionist and food analyst.',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: this.extractBase64Data(imageUrl),
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    // Parse the JSON response
    return this.parseAnalysisResponse(textContent);
  }

  /**
   * Build the prompt for food analysis
   */
  private buildAnalysisPrompt(): string {
    return `You are an expert nutritionist and food analyst. Analyze this food photo and provide detailed nutritional information.

Please respond with a JSON object in the following format:
{
  "meal_name": "Brief name of the meal (e.g., 'Grilled Chicken Salad')",
  "description": "Detailed description of what you see (cooking method, ingredients, portion size)",
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "estimated amount (e.g., '150g' or '1 cup')",
      "confidence": "high|medium|low"
    }
  ],
  "estimated_nutrition": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number (optional)
  },
  "portion_size_estimate": "Description of portion size (e.g., 'Large dinner portion, approximately 600g total')",
  "confidence_score": 0-100 (overall confidence in your analysis),
  "warnings": ["Any concerns or disclaimers (optional)"]
}

Important guidelines:
- Be realistic about portion sizes - use visible cues (plate size, utensils, food containers)
- Consider cooking methods (fried adds calories, grilled is leaner, etc.)
- Account for all visible components of the meal
- If the meal has multiple components, list them all separately in ingredients
- Be conservative with calorie estimates - it's better to underestimate than overestimate
- If the photo is unclear or portion sizes are difficult to estimate, lower your confidence score
- Include warnings if you're uncertain about any aspect

Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse the JSON response from Claude
   */
  private parseAnalysisResponse(text: string): FoodAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.meal_name || !parsed.estimated_nutrition) {
        throw new Error('Invalid response format: missing required fields');
      }

      // Ensure nutrition values are numbers and within sane bounds
      const rawNutrition = {
        calories: Number(parsed.estimated_nutrition.calories) || 0,
        protein_g: Number(parsed.estimated_nutrition.protein_g) || 0,
        carbs_g: Number(parsed.estimated_nutrition.carbs_g) || 0,
        fat_g: Number(parsed.estimated_nutrition.fat_g) || 0,
        fiber_g: parsed.estimated_nutrition.fiber_g
          ? Number(parsed.estimated_nutrition.fiber_g)
          : undefined,
      };

      parsed.estimated_nutrition = {
        calories: clampNutrition(rawNutrition.calories, 'calories'),
        protein_g: clampNutrition(rawNutrition.protein_g, 'protein_g'),
        carbs_g: clampNutrition(rawNutrition.carbs_g, 'carbs_g'),
        fat_g: clampNutrition(rawNutrition.fat_g, 'fat_g'),
        fiber_g:
          rawNutrition.fiber_g !== undefined
            ? clampNutrition(rawNutrition.fiber_g, 'fiber_g')
            : undefined,
      };

      const clampedFields: string[] = [];
      for (const field of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const) {
        const raw = rawNutrition[field];
        const clamped = parsed.estimated_nutrition[field];
        if (raw !== undefined && clamped !== undefined && raw !== clamped) {
          clampedFields.push(`${field}: ${raw} -> ${clamped}`);
        }
      }
      if (clampedFields.length > 0) {
        if (!Array.isArray(parsed.warnings)) {
          parsed.warnings = [];
        }
        parsed.warnings.push(
          `Nutrition values were clamped to sane bounds: ${clampedFields.join(', ')}`
        );
      }

      return parsed as FoodAnalysisResult;
    } catch (error) {
      logger.error('Failed to parse Claude response:', error);
      logger.debug('Response text:', text);

      // Return a fallback response
      return {
        meal_name: 'Unknown Meal',
        description: 'Could not analyze this photo. Please try again with a clearer photo.',
        ingredients: [],
        estimated_nutrition: {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        },
        portion_size_estimate: 'Unknown',
        confidence_score: 0,
        warnings: [
          'Failed to analyze photo. Please ensure the food is clearly visible and well-lit.',
        ],
      };
    }
  }

  /**
   * Extract base64 data from a URL
   * Handles both data URLs and regular URLs
   */
  private extractBase64Data(imageUrl: string): string {
    if (imageUrl.startsWith('data:')) {
      // Remove the data:image/...;base64, prefix
      return imageUrl.split(',')[1] || imageUrl;
    }

    // If it's a regular URL, we'd need to fetch and convert
    // For now, we'll assume the caller has already converted to base64
    return imageUrl;
  }

  /**
   * Convert a file to base64
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate an image file before processing
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 10MB.',
      };
    }

    // Check minimum size (at least 10KB to avoid corrupted files)
    const minSize = 10 * 1024;
    if (file.size < minSize) {
      return {
        valid: false,
        error: 'File too small. Please upload a valid image.',
      };
    }

    return { valid: true };
  }
}

// Singleton instance
let visionClient: ClaudeVisionClient | null = null;

export function getVisionClient(): ClaudeVisionClient {
  if (!visionClient) {
    visionClient = new ClaudeVisionClient();
  }
  return visionClient;
}
