/**
 * FatSecret Platform API Adapter
 * Provides typed interface for food and recipe search, autocomplete, and details.
 * Falls back to a comprehensive local food database when FatSecret credentials are unavailable.
 */

export interface FoodSearchResult {
  foodId: string;
  name: string;
  description: string;
  brandName?: string;
}

export interface FoodDetails {
  foodId: string;
  name: string;
  brandName?: string;
  servings: FoodServing[];
}

export interface FoodServing {
  servingId: string;
  servingDescription: string;
  metricServingAmount?: number;
  metricServingUnit?: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fiber?: number;
}

export interface RecipeSearchResult {
  recipeId: string;
  name: string;
  description: string;
  preparationTimeMin?: number;
  cookingTimeMin?: number;
}

export interface RecipeDetails {
  recipeId: string;
  name: string;
  description: string;
  preparationTimeMin?: number;
  cookingTimeMin?: number;
  servingSize: number;
  ingredients: RecipeIngredient[];
  directions: RecipeDirection[];
  nutrition: {
    calories: number;
    protein: number;
    carbohydrate: number;
    fat: number;
    fiber?: number;
  };
}

export interface RecipeIngredient {
  foodId?: string;
  name: string;
  amount: string;
}

export interface RecipeDirection {
  stepNumber: number;
  description: string;
}

export class FatSecretAdapter {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private isConfigured(): boolean {
    return !!(
      this.clientId &&
      this.clientSecret &&
      this.clientId !== '...' &&
      this.clientSecret !== '...' &&
      !this.clientId.includes('placeholder')
    );
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 2,
    timeoutMs = 10000
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, { ...options, signal: controller.signal });

          if (response.status === 429 || response.status >= 500) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter
              ? parseInt(retryAfter) * 1000
              : Math.pow(2, attempt) * 1000 + Math.random() * 500;

            if (attempt < maxRetries) {
              console.warn(
                `[FatSecret] ${response.status} on attempt ${attempt + 1}, retrying in ${Math.round(delay)}ms`
              );
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          return response;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `[FatSecret] Network error on attempt ${attempt + 1}, retrying in ${delay}ms: ${(error as Error).message}`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('FatSecret API request failed after retries');
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://oauth.fatsecret.com/connect/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          },
          body: 'grant_type=client_credentials&scope=basic',
        });

        if (!response.ok) {
          throw new Error(`FatSecret auth failed: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        this.accessToken = data.access_token;
        // Expire 60s early to avoid edge cases
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken!;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 1000;
          console.warn(
            `[FatSecret] Auth error on attempt ${attempt + 1}, retrying in ${delay}ms: ${(error as Error).message}`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('FatSecret auth failed after retries');
  }

  private async apiRequest(method: string, params: Record<string, string>): Promise<any> {
    const token = await this.authenticate();
    const url = new URL('https://platform.fatsecret.com/rest/server.api');
    url.searchParams.set('method', method);
    url.searchParams.set('format', 'json');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const response = await this.fetchWithRetry(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`FatSecret API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): Promise<FoodSearchResult[]> {
    if (!this.isConfigured()) {
      return LocalFoodDatabase.searchFoods(query, maxResults, pageNumber);
    }

    const data = await this.apiRequest('foods.search', {
      search_expression: query,
      max_results: String(maxResults),
      page_number: String(pageNumber),
    });

    const foods = data?.foods?.food;
    if (!foods) {
      return [];
    }

    const foodArray = Array.isArray(foods) ? foods : [foods];
    return foodArray.map((f: any) => ({
      foodId: String(f.food_id),
      name: f.food_name,
      description: f.food_description || '',
      brandName: f.brand_name || undefined,
    }));
  }

  async getFood(foodId: string): Promise<FoodDetails> {
    if (!this.isConfigured()) {
      return LocalFoodDatabase.getFood(foodId);
    }

    const data = await this.apiRequest('food.get.v4', { food_id: foodId });
    const food = data?.food;
    if (!food) {
      throw new Error(`Food ${foodId} not found`);
    }

    const servingsData = food.servings?.serving;
    const servingsArray = Array.isArray(servingsData)
      ? servingsData
      : servingsData
        ? [servingsData]
        : [];

    return {
      foodId: String(food.food_id),
      name: food.food_name,
      brandName: food.brand_name || undefined,
      servings: servingsArray.map((s: any) => ({
        servingId: String(s.serving_id),
        servingDescription: s.serving_description || s.measurement_description || '1 serving',
        metricServingAmount: s.metric_serving_amount ? Number(s.metric_serving_amount) : undefined,
        metricServingUnit: s.metric_serving_unit || undefined,
        calories: Number(s.calories) || 0,
        protein: Number(s.protein) || 0,
        carbohydrate: Number(s.carbohydrate) || 0,
        fat: Number(s.fat) || 0,
        fiber: s.fiber ? Number(s.fiber) : undefined,
      })),
    };
  }

  async getFoodByBarcode(barcode: string): Promise<FoodDetails | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const data = await this.apiRequest('food.find_id_for_barcode', { barcode });
      const foodId = data?.food_id?.value;
      if (!foodId) {
        return null;
      }
      return this.getFood(foodId);
    } catch {
      return null;
    }
  }

  async searchRecipes(query: string, maxResults: number = 10): Promise<RecipeSearchResult[]> {
    if (!this.isConfigured()) {
      return LocalRecipeDatabase.searchRecipes(query, maxResults);
    }

    const data = await this.apiRequest('recipes.search', {
      search_expression: query,
      max_results: String(maxResults),
    });

    const recipes = data?.recipes?.recipe;
    if (!recipes) {
      return [];
    }

    const arr = Array.isArray(recipes) ? recipes : [recipes];
    return arr.map((r: any) => ({
      recipeId: String(r.recipe_id),
      name: r.recipe_name,
      description: r.recipe_description || '',
      preparationTimeMin: r.preparation_time_min ? Number(r.preparation_time_min) : undefined,
      cookingTimeMin: r.cooking_time_min ? Number(r.cooking_time_min) : undefined,
    }));
  }

  async getRecipe(recipeId: string): Promise<RecipeDetails> {
    if (!this.isConfigured()) {
      throw new Error('Recipe lookup requires FatSecret API credentials');
    }

    const data = await this.apiRequest('recipe.get.v2', { recipe_id: recipeId });
    const r = data?.recipe;
    if (!r) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    return {
      recipeId: String(r.recipe_id),
      name: r.recipe_name,
      description: r.recipe_description || '',
      preparationTimeMin: r.preparation_time_min ? Number(r.preparation_time_min) : undefined,
      cookingTimeMin: r.cooking_time_min ? Number(r.cooking_time_min) : undefined,
      servingSize: Number(r.number_of_servings) || 1,
      ingredients: (r.ingredients?.ingredient || []).map((i: any) => ({
        foodId: i.food_id ? String(i.food_id) : undefined,
        name: i.ingredient_description || i.food_name || '',
        amount: i.number_of_units
          ? `${i.number_of_units} ${i.measurement_description || ''}`.trim()
          : '',
      })),
      directions: (r.directions?.direction || []).map((d: any) => ({
        stepNumber: Number(d.direction_number) || 0,
        description: d.direction_description || '',
      })),
      nutrition: {
        calories: Number(r.serving_sizes?.serving?.calories) || 0,
        protein: Number(r.serving_sizes?.serving?.protein) || 0,
        carbohydrate: Number(r.serving_sizes?.serving?.carbohydrate) || 0,
        fat: Number(r.serving_sizes?.serving?.fat) || 0,
        fiber: r.serving_sizes?.serving?.fiber ? Number(r.serving_sizes.serving.fiber) : undefined,
      },
    };
  }

  async autocomplete(query: string): Promise<string[]> {
    if (!this.isConfigured()) {
      return LocalFoodDatabase.autocomplete(query);
    }

    const data = await this.apiRequest('foods.autocomplete', {
      expression: query,
    });

    const suggestions = data?.suggestions?.suggestion;
    if (!suggestions) {
      return [];
    }

    const arr = Array.isArray(suggestions) ? suggestions : [suggestions];
    return arr.map((s: any) => (typeof s === 'string' ? s : s.suggestion || String(s)));
  }
}

/**
 * Comprehensive local food database for development/fallback.
 * Contains real USDA-sourced nutrition data for common foods.
 */
export class LocalFoodDatabase {
  private static foods: Array<{
    foodId: string;
    name: string;
    description: string;
    brandName?: string;
    servings: FoodServing[];
  }> = [
    {
      foodId: 'local-1',
      name: 'Chicken Breast, Grilled',
      description: 'Per 100g - Calories: 165kcal | Fat: 3.6g | Carbs: 0g | Protein: 31g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 breast (172g)',
          metricServingAmount: 172,
          metricServingUnit: 'g',
          calories: 284,
          protein: 53.3,
          carbohydrate: 0,
          fat: 6.2,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 165,
          protein: 31,
          carbohydrate: 0,
          fat: 3.6,
          fiber: 0,
        },
        {
          servingId: 's3',
          servingDescription: '4 oz (113g)',
          metricServingAmount: 113,
          metricServingUnit: 'g',
          calories: 186,
          protein: 35,
          carbohydrate: 0,
          fat: 4.1,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-2',
      name: 'Chicken Thigh, Boneless Skinless',
      description: 'Per 100g - Calories: 177kcal | Fat: 8.4g | Carbs: 0g | Protein: 24.2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 thigh (116g)',
          metricServingAmount: 116,
          metricServingUnit: 'g',
          calories: 205,
          protein: 28.1,
          carbohydrate: 0,
          fat: 9.7,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 177,
          protein: 24.2,
          carbohydrate: 0,
          fat: 8.4,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-3',
      name: 'Chicken Wings',
      description: 'Per 100g - Calories: 203kcal | Fat: 12.8g | Carbs: 0g | Protein: 20.3g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 wing (34g)',
          metricServingAmount: 34,
          metricServingUnit: 'g',
          calories: 69,
          protein: 6.9,
          carbohydrate: 0,
          fat: 4.4,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 203,
          protein: 20.3,
          carbohydrate: 0,
          fat: 12.8,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-4',
      name: 'Brown Rice, Cooked',
      description: 'Per 100g - Calories: 123kcal | Fat: 1g | Carbs: 25.6g | Protein: 2.7g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (202g)',
          metricServingAmount: 202,
          metricServingUnit: 'g',
          calories: 248,
          protein: 5.5,
          carbohydrate: 51.7,
          fat: 2,
          fiber: 3.2,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 123,
          protein: 2.7,
          carbohydrate: 25.6,
          fat: 1,
          fiber: 1.6,
        },
      ],
    },
    {
      foodId: 'local-5',
      name: 'White Rice, Cooked',
      description: 'Per 100g - Calories: 130kcal | Fat: 0.3g | Carbs: 28.2g | Protein: 2.7g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (186g)',
          metricServingAmount: 186,
          metricServingUnit: 'g',
          calories: 242,
          protein: 5,
          carbohydrate: 52.5,
          fat: 0.6,
          fiber: 0.6,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 130,
          protein: 2.7,
          carbohydrate: 28.2,
          fat: 0.3,
          fiber: 0.3,
        },
      ],
    },
    {
      foodId: 'local-6',
      name: 'Salmon, Atlantic, Cooked',
      description: 'Per 100g - Calories: 208kcal | Fat: 12.4g | Carbs: 0g | Protein: 22.1g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 fillet (178g)',
          metricServingAmount: 178,
          metricServingUnit: 'g',
          calories: 370,
          protein: 39.3,
          carbohydrate: 0,
          fat: 22.1,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 208,
          protein: 22.1,
          carbohydrate: 0,
          fat: 12.4,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-7',
      name: 'Broccoli, Steamed',
      description: 'Per 100g - Calories: 35kcal | Fat: 0.4g | Carbs: 7.2g | Protein: 2.4g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup chopped (156g)',
          metricServingAmount: 156,
          metricServingUnit: 'g',
          calories: 55,
          protein: 3.7,
          carbohydrate: 11.2,
          fat: 0.6,
          fiber: 5.1,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 35,
          protein: 2.4,
          carbohydrate: 7.2,
          fat: 0.4,
          fiber: 3.3,
        },
      ],
    },
    {
      foodId: 'local-8',
      name: 'Banana, Raw',
      description: 'Per 100g - Calories: 89kcal | Fat: 0.3g | Carbs: 22.8g | Protein: 1.1g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 medium (118g)',
          metricServingAmount: 118,
          metricServingUnit: 'g',
          calories: 105,
          protein: 1.3,
          carbohydrate: 26.9,
          fat: 0.4,
          fiber: 3.1,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 89,
          protein: 1.1,
          carbohydrate: 22.8,
          fat: 0.3,
          fiber: 2.6,
        },
      ],
    },
    {
      foodId: 'local-9',
      name: 'Whole Wheat Bread',
      description: 'Per slice - Calories: 79kcal | Fat: 1.1g | Carbs: 13.7g | Protein: 3.9g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 slice (33g)',
          metricServingAmount: 33,
          metricServingUnit: 'g',
          calories: 79,
          protein: 3.9,
          carbohydrate: 13.7,
          fat: 1.1,
          fiber: 1.9,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 240,
          protein: 11.8,
          carbohydrate: 41.3,
          fat: 3.4,
          fiber: 5.8,
        },
      ],
    },
    {
      foodId: 'local-10',
      name: 'Egg, Whole, Hard-Boiled',
      description: 'Per large egg - Calories: 78kcal | Fat: 5.3g | Carbs: 0.6g | Protein: 6.3g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 large egg (50g)',
          metricServingAmount: 50,
          metricServingUnit: 'g',
          calories: 78,
          protein: 6.3,
          carbohydrate: 0.6,
          fat: 5.3,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 155,
          protein: 12.6,
          carbohydrate: 1.1,
          fat: 10.6,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-11',
      name: 'Greek Yogurt, Plain, Nonfat',
      description: 'Per 100g - Calories: 59kcal | Fat: 0.4g | Carbs: 3.6g | Protein: 10.2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 container (170g)',
          metricServingAmount: 170,
          metricServingUnit: 'g',
          calories: 100,
          protein: 17.3,
          carbohydrate: 6.1,
          fat: 0.7,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 59,
          protein: 10.2,
          carbohydrate: 3.6,
          fat: 0.4,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-12',
      name: 'Sweet Potato, Baked',
      description: 'Per 100g - Calories: 90kcal | Fat: 0.2g | Carbs: 20.7g | Protein: 2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 medium (114g)',
          metricServingAmount: 114,
          metricServingUnit: 'g',
          calories: 103,
          protein: 2.3,
          carbohydrate: 23.6,
          fat: 0.2,
          fiber: 3.8,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 90,
          protein: 2,
          carbohydrate: 20.7,
          fat: 0.2,
          fiber: 3.3,
        },
      ],
    },
    {
      foodId: 'local-13',
      name: 'Oats, Rolled, Dry',
      description: 'Per 100g - Calories: 379kcal | Fat: 6.5g | Carbs: 67.7g | Protein: 13.2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1/2 cup dry (40g)',
          metricServingAmount: 40,
          metricServingUnit: 'g',
          calories: 152,
          protein: 5.3,
          carbohydrate: 27.1,
          fat: 2.6,
          fiber: 4,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 379,
          protein: 13.2,
          carbohydrate: 67.7,
          fat: 6.5,
          fiber: 10.1,
        },
      ],
    },
    {
      foodId: 'local-14',
      name: 'Avocado, Raw',
      description: 'Per 100g - Calories: 160kcal | Fat: 14.7g | Carbs: 8.5g | Protein: 2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1/2 avocado (68g)',
          metricServingAmount: 68,
          metricServingUnit: 'g',
          calories: 109,
          protein: 1.4,
          carbohydrate: 5.8,
          fat: 10,
          fiber: 4.6,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 160,
          protein: 2,
          carbohydrate: 8.5,
          fat: 14.7,
          fiber: 6.7,
        },
      ],
    },
    {
      foodId: 'local-15',
      name: 'Almonds, Raw',
      description: 'Per 100g - Calories: 579kcal | Fat: 49.9g | Carbs: 21.6g | Protein: 21.2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 oz (28g, ~23 almonds)',
          metricServingAmount: 28,
          metricServingUnit: 'g',
          calories: 162,
          protein: 5.9,
          carbohydrate: 6,
          fat: 14,
          fiber: 3.5,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 579,
          protein: 21.2,
          carbohydrate: 21.6,
          fat: 49.9,
          fiber: 12.2,
        },
      ],
    },
    {
      foodId: 'local-16',
      name: 'Ground Beef, 90% Lean',
      description: 'Per 100g - Calories: 176kcal | Fat: 10g | Carbs: 0g | Protein: 20g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '4 oz patty (113g)',
          metricServingAmount: 113,
          metricServingUnit: 'g',
          calories: 199,
          protein: 22.6,
          carbohydrate: 0,
          fat: 11.3,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 176,
          protein: 20,
          carbohydrate: 0,
          fat: 10,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-17',
      name: 'Olive Oil, Extra Virgin',
      description: 'Per tablespoon - Calories: 119kcal | Fat: 13.5g | Carbs: 0g | Protein: 0g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 tablespoon (14g)',
          metricServingAmount: 14,
          metricServingUnit: 'ml',
          calories: 119,
          protein: 0,
          carbohydrate: 0,
          fat: 13.5,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100ml',
          metricServingAmount: 100,
          metricServingUnit: 'ml',
          calories: 884,
          protein: 0,
          carbohydrate: 0,
          fat: 100,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-18',
      name: 'Spinach, Raw',
      description: 'Per 100g - Calories: 23kcal | Fat: 0.4g | Carbs: 3.6g | Protein: 2.9g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (30g)',
          metricServingAmount: 30,
          metricServingUnit: 'g',
          calories: 7,
          protein: 0.9,
          carbohydrate: 1.1,
          fat: 0.1,
          fiber: 0.7,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 23,
          protein: 2.9,
          carbohydrate: 3.6,
          fat: 0.4,
          fiber: 2.2,
        },
      ],
    },
    {
      foodId: 'local-19',
      name: 'Cheddar Cheese',
      description: 'Per 100g - Calories: 403kcal | Fat: 33.1g | Carbs: 1.3g | Protein: 24.9g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 slice (28g)',
          metricServingAmount: 28,
          metricServingUnit: 'g',
          calories: 113,
          protein: 7,
          carbohydrate: 0.4,
          fat: 9.3,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 403,
          protein: 24.9,
          carbohydrate: 1.3,
          fat: 33.1,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-20',
      name: 'Whey Protein Powder',
      description: 'Per scoop - Calories: 120kcal | Fat: 1g | Carbs: 3g | Protein: 24g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 scoop (31g)',
          metricServingAmount: 31,
          metricServingUnit: 'g',
          calories: 120,
          protein: 24,
          carbohydrate: 3,
          fat: 1,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 387,
          protein: 77.4,
          carbohydrate: 9.7,
          fat: 3.2,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-21',
      name: 'Apple, Raw, with Skin',
      description: 'Per 100g - Calories: 52kcal | Fat: 0.2g | Carbs: 13.8g | Protein: 0.3g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 medium (182g)',
          metricServingAmount: 182,
          metricServingUnit: 'g',
          calories: 95,
          protein: 0.5,
          carbohydrate: 25.1,
          fat: 0.3,
          fiber: 4.4,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 52,
          protein: 0.3,
          carbohydrate: 13.8,
          fat: 0.2,
          fiber: 2.4,
        },
      ],
    },
    {
      foodId: 'local-22',
      name: 'Peanut Butter, Smooth',
      description: 'Per 100g - Calories: 588kcal | Fat: 50g | Carbs: 20g | Protein: 25g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '2 tablespoons (32g)',
          metricServingAmount: 32,
          metricServingUnit: 'g',
          calories: 188,
          protein: 8,
          carbohydrate: 6.4,
          fat: 16,
          fiber: 1.9,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 588,
          protein: 25,
          carbohydrate: 20,
          fat: 50,
          fiber: 6,
        },
      ],
    },
    {
      foodId: 'local-23',
      name: 'Tuna, Canned in Water',
      description: 'Per 100g - Calories: 116kcal | Fat: 0.8g | Carbs: 0g | Protein: 25.5g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 can drained (142g)',
          metricServingAmount: 142,
          metricServingUnit: 'g',
          calories: 165,
          protein: 36.2,
          carbohydrate: 0,
          fat: 1.1,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 116,
          protein: 25.5,
          carbohydrate: 0,
          fat: 0.8,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-24',
      name: 'Pasta, Whole Wheat, Cooked',
      description: 'Per 100g - Calories: 124kcal | Fat: 0.5g | Carbs: 26.5g | Protein: 5.3g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (140g)',
          metricServingAmount: 140,
          metricServingUnit: 'g',
          calories: 174,
          protein: 7.5,
          carbohydrate: 37.2,
          fat: 0.8,
          fiber: 4.5,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 124,
          protein: 5.3,
          carbohydrate: 26.5,
          fat: 0.5,
          fiber: 3.2,
        },
      ],
    },
    {
      foodId: 'local-25',
      name: 'Milk, Whole',
      description: 'Per 100ml - Calories: 61kcal | Fat: 3.3g | Carbs: 4.8g | Protein: 3.2g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (244ml)',
          metricServingAmount: 244,
          metricServingUnit: 'ml',
          calories: 149,
          protein: 7.8,
          carbohydrate: 11.7,
          fat: 8.1,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100ml',
          metricServingAmount: 100,
          metricServingUnit: 'ml',
          calories: 61,
          protein: 3.2,
          carbohydrate: 4.8,
          fat: 3.3,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-26',
      name: 'Chickpeas, Cooked',
      description: 'Per 100g - Calories: 164kcal | Fat: 2.6g | Carbs: 27.4g | Protein: 8.9g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (164g)',
          metricServingAmount: 164,
          metricServingUnit: 'g',
          calories: 269,
          protein: 14.5,
          carbohydrate: 44.9,
          fat: 4.2,
          fiber: 12.5,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 164,
          protein: 8.9,
          carbohydrate: 27.4,
          fat: 2.6,
          fiber: 7.6,
        },
      ],
    },
    {
      foodId: 'local-27',
      name: 'Cottage Cheese, Low Fat (2%)',
      description: 'Per 100g - Calories: 84kcal | Fat: 2.3g | Carbs: 3.1g | Protein: 12.4g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (226g)',
          metricServingAmount: 226,
          metricServingUnit: 'g',
          calories: 190,
          protein: 28,
          carbohydrate: 7,
          fat: 5.2,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 84,
          protein: 12.4,
          carbohydrate: 3.1,
          fat: 2.3,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-28',
      name: 'Blueberries, Raw',
      description: 'Per 100g - Calories: 57kcal | Fat: 0.3g | Carbs: 14.5g | Protein: 0.7g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (148g)',
          metricServingAmount: 148,
          metricServingUnit: 'g',
          calories: 84,
          protein: 1.1,
          carbohydrate: 21.4,
          fat: 0.5,
          fiber: 3.6,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 57,
          protein: 0.7,
          carbohydrate: 14.5,
          fat: 0.3,
          fiber: 2.4,
        },
      ],
    },
    {
      foodId: 'local-29',
      name: 'Turkey Breast, Deli Sliced',
      description: 'Per 100g - Calories: 104kcal | Fat: 1.7g | Carbs: 1.2g | Protein: 21.1g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '4 slices (56g)',
          metricServingAmount: 56,
          metricServingUnit: 'g',
          calories: 58,
          protein: 11.8,
          carbohydrate: 0.7,
          fat: 1,
          fiber: 0,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 104,
          protein: 21.1,
          carbohydrate: 1.2,
          fat: 1.7,
          fiber: 0,
        },
      ],
    },
    {
      foodId: 'local-30',
      name: 'Quinoa, Cooked',
      description: 'Per 100g - Calories: 120kcal | Fat: 1.9g | Carbs: 21.3g | Protein: 4.4g',
      servings: [
        {
          servingId: 's1',
          servingDescription: '1 cup (185g)',
          metricServingAmount: 185,
          metricServingUnit: 'g',
          calories: 222,
          protein: 8.1,
          carbohydrate: 39.4,
          fat: 3.5,
          fiber: 5.2,
        },
        {
          servingId: 's2',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 120,
          protein: 4.4,
          carbohydrate: 21.3,
          fat: 1.9,
          fiber: 2.8,
        },
      ],
    },
  ];

  static searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): FoodSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }

    // Split query into words for flexible matching
    const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);

    // Score each food by how many query words match
    const scored = this.foods
      .map((f) => {
        const nameLower = f.name.toLowerCase();
        // Check exact substring match first (highest priority)
        if (nameLower.includes(q)) {
          return { food: f, score: 100 };
        }
        // Count how many query words appear in the food name
        const matchCount = queryWords.filter((w) => nameLower.includes(w)).length;
        return { food: f, score: matchCount };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Apply pagination
    const offset = pageNumber * maxResults;
    const paginated = scored.slice(offset, offset + maxResults);

    return paginated.map((item) => ({
      foodId: item.food.foodId,
      name: item.food.name,
      description: item.food.description,
      brandName: item.food.brandName,
    }));
  }

  static getFood(foodId: string): FoodDetails {
    const food = this.foods.find((f) => f.foodId === foodId);
    if (!food) {
      throw new Error(`Food ${foodId} not found in local database`);
    }
    return {
      foodId: food.foodId,
      name: food.name,
      brandName: food.brandName,
      servings: food.servings,
    };
  }

  static autocomplete(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) {
      return [];
    }

    // Get unique food name prefixes that match
    const matches = this.foods
      .filter((f) => f.name.toLowerCase().includes(q))
      .map((f) => f.name)
      .slice(0, 8);

    return matches;
  }
}

/**
 * Local recipe database for development/fallback when FatSecret credentials are unavailable.
 * Contains common healthy recipes with realistic metadata.
 */
export class LocalRecipeDatabase {
  private static recipes: RecipeSearchResult[] = [
    {
      recipeId: 'local-r1',
      name: 'Grilled Chicken Breast with Lemon Herb',
      description:
        'Juicy grilled chicken breast marinated in lemon, garlic, and fresh herbs. High protein, low carb.',
      preparationTimeMin: 15,
      cookingTimeMin: 20,
    },
    {
      recipeId: 'local-r2',
      name: 'Grilled Chicken Caesar Salad',
      description:
        'Classic Caesar salad topped with grilled chicken breast, croutons, and parmesan.',
      preparationTimeMin: 10,
      cookingTimeMin: 15,
    },
    {
      recipeId: 'local-r3',
      name: 'Chicken Stir Fry with Vegetables',
      description: 'Quick and healthy chicken stir fry with broccoli, bell peppers, and soy sauce.',
      preparationTimeMin: 15,
      cookingTimeMin: 12,
    },
    {
      recipeId: 'local-r4',
      name: 'Grilled Salmon with Asparagus',
      description: 'Omega-3 rich salmon fillet grilled alongside fresh asparagus spears.',
      preparationTimeMin: 10,
      cookingTimeMin: 18,
    },
    {
      recipeId: 'local-r5',
      name: 'Turkey Meatballs with Marinara',
      description: 'Lean turkey meatballs baked and served with homemade marinara sauce.',
      preparationTimeMin: 20,
      cookingTimeMin: 25,
    },
    {
      recipeId: 'local-r6',
      name: 'Quinoa Buddha Bowl',
      description: 'Nutritious bowl with quinoa, roasted chickpeas, avocado, and tahini dressing.',
      preparationTimeMin: 15,
      cookingTimeMin: 20,
    },
    {
      recipeId: 'local-r7',
      name: 'Beef and Broccoli Stir Fry',
      description: 'Tender beef strips with broccoli florets in a savory garlic ginger sauce.',
      preparationTimeMin: 15,
      cookingTimeMin: 10,
    },
    {
      recipeId: 'local-r8',
      name: 'Overnight Oats with Berries',
      description: 'Creamy overnight oats made with Greek yogurt, chia seeds, and mixed berries.',
      preparationTimeMin: 10,
      cookingTimeMin: 0,
    },
    {
      recipeId: 'local-r9',
      name: 'Grilled Chicken Tacos',
      description: 'Flavorful grilled chicken tacos with fresh salsa, avocado, and lime crema.',
      preparationTimeMin: 20,
      cookingTimeMin: 15,
    },
    {
      recipeId: 'local-r10',
      name: 'Sweet Potato and Black Bean Chili',
      description: 'Hearty vegetarian chili with sweet potatoes, black beans, and warming spices.',
      preparationTimeMin: 15,
      cookingTimeMin: 35,
    },
    {
      recipeId: 'local-r11',
      name: 'Pan-Seared Chicken Thighs with Mushrooms',
      description: 'Crispy skin chicken thighs with sautéed mushrooms in a creamy sauce.',
      preparationTimeMin: 10,
      cookingTimeMin: 25,
    },
    {
      recipeId: 'local-r12',
      name: 'Egg White Omelette with Spinach',
      description: 'Light and fluffy egg white omelette loaded with spinach, tomatoes, and feta.',
      preparationTimeMin: 5,
      cookingTimeMin: 8,
    },
    {
      recipeId: 'local-r13',
      name: 'Tuna Poke Bowl',
      description: 'Fresh ahi tuna poke bowl with sushi rice, edamame, cucumber, and sesame.',
      preparationTimeMin: 20,
      cookingTimeMin: 15,
    },
    {
      recipeId: 'local-r14',
      name: 'Mediterranean Grilled Chicken Wrap',
      description:
        'Grilled chicken wrapped in whole wheat tortilla with hummus, cucumber, and olives.',
      preparationTimeMin: 10,
      cookingTimeMin: 12,
    },
    {
      recipeId: 'local-r15',
      name: 'Protein Pancakes with Banana',
      description: 'Fluffy protein pancakes made with oats, banana, and whey protein powder.',
      preparationTimeMin: 10,
      cookingTimeMin: 10,
    },
  ];

  static searchRecipes(query: string, maxResults: number = 10): RecipeSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }

    const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);

    const scored = this.recipes
      .map((r) => {
        const nameLower = r.name.toLowerCase();
        const descLower = r.description.toLowerCase();
        // Exact substring match in name (highest priority)
        if (nameLower.includes(q)) {
          return { recipe: r, score: 100 };
        }
        // Count query word matches in name and description
        const nameMatches = queryWords.filter((w) => nameLower.includes(w)).length;
        const descMatches = queryWords.filter((w) => descLower.includes(w)).length;
        return { recipe: r, score: nameMatches * 2 + descMatches };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored.map((item) => item.recipe);
  }
}
