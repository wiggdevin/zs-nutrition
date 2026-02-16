export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface SearchResultNutrition {
  servingDescription: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

export interface SearchResultServing {
  servingDescription: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

export interface FoodSearchResult {
  foodId: string;
  name: string;
  description: string;
  brandName?: string;
  verified?: boolean;
  nutrition?: SearchResultNutrition | null;
  servings?: SearchResultServing[];
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

export interface FoodDetails {
  foodId: string;
  name: string;
  brandName?: string;
  servings: FoodServing[];
}

export const MAX_SEARCH_LENGTH = 200;
