export interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

export interface Meal {
  slot: string;
  name: string;
  cuisine?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  nutrition: MealNutrition;
  confidenceLevel?: string;
  ingredients?: Array<{
    name: string;
    amount: number | string; // Support both old (string) and new (number) formats
    fatsecretFoodId?: string;
    unit?: string;
  }>;
  instructions?: string[];
}

export interface PlanDay {
  dayNumber: number;
  dayName: string;
  isTrainingDay: boolean;
  targetKcal: number;
  meals: Meal[];
}

export interface GroceryItem {
  name: string;
  amount: number;
  unit: string;
}

export interface GroceryCategory {
  category: string;
  items: GroceryItem[];
}

export interface PlanData {
  id: string;
  dailyKcalTarget: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;
  trainingBonusKcal: number | null;
  planDays: number;
  startDate: string;
  endDate: string;
  qaScore: number | null;
  qaStatus: string | null;
  status: string;
  generatedAt: string;
  pdfUrl?: string | null;
  validatedPlan: {
    days: PlanDay[];
    groceryList?: unknown[];
    qa?: { status: string; score: number; iterations?: number };
    weeklyTotals?: {
      avgKcal: number;
      avgProteinG: number;
      avgCarbsG: number;
      avgFatG: number;
    };
  };
  metabolicProfile: {
    bmrKcal?: number;
    tdeeKcal?: number;
    goalKcal?: number;
    proteinTargetG?: number;
    carbsTargetG?: number;
    fatTargetG?: number;
  };
  profile?: {
    name: string;
    sex: string;
    age: number;
    goalType: string;
    activityLevel: string;
  };
}

export interface SwapTarget {
  dayNumber: number;
  mealIdx: number;
  meal: Meal;
}
