/** Typed cache shape for getDailySummary to preserve tRPC inference. */
export interface DailySummaryResult {
  date: string;
  dailyLog: {
    id: string;
    targetKcal: number | null;
    targetProteinG: number | null;
    targetCarbsG: number | null;
    targetFatG: number | null;
    actualKcal: number;
    actualProteinG: number;
    actualCarbsG: number;
    actualFatG: number;
    adherenceScore: number;
  } | null;
  trackedMeals: {
    id: string;
    mealPlanId: string | null;
    mealSlot: string | null;
    mealName: string;
    portion: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    source: string;
    confidenceScore: number | null;
    createdAt: Date;
  }[];
  totals: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  mealCount: number;
}
