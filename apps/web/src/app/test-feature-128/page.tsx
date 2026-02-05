"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";
import MealDetailModal from "@/components/meal-plan/MealDetailModal";

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

interface Meal {
  slot: string;
  name: string;
  cuisine?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  nutrition: MealNutrition;
  confidenceLevel?: string;
  ingredients?: Array<{
    name: string;
    amount: number | string;
    unit?: string;
    fatsecretFoodId?: string;
  }>;
  instructions?: string[];
}

export default function TestFeature128Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  // Sample meal with complete data
  const sampleMeal: Meal = {
    slot: "lunch",
    name: "Grilled Chicken Breast with Quinoa and Roasted Vegetables",
    cuisine: "Mediterranean",
    prepTimeMin: 15,
    cookTimeMin: 25,
    nutrition: {
      kcal: 520,
      proteinG: 42,
      carbsG: 38,
      fatG: 18,
      fiberG: 8,
    },
    confidenceLevel: "verified",
    ingredients: [
      { name: "Chicken breast", amount: 6, unit: "oz", fatsecretFoodId: "12345" },
      { name: "Quinoa", amount: 1, unit: "cup", fatsecretFoodId: "67890" },
      { name: "Olive oil", amount: 1, unit: "tbsp", fatsecretFoodId: "11111" },
      { name: "Broccoli", amount: 2, unit: "cups", fatsecretFoodId: "22222" },
      { name: "Bell peppers", amount: 1, unit: "medium", fatsecretFoodId: "33333" },
      { name: "Cherry tomatoes", amount: 1, unit: "cup", fatsecretFoodId: "44444" },
      { name: "Garlic", amount: 2, unit: "cloves", fatsecretFoodId: "55555" },
      { name: "Lemon juice", amount: 1, unit: "tbsp", fatsecretFoodId: "66666" },
      { name: "Salt", amount: 0.5, unit: "tsp", fatsecretFoodId: "77777" },
      { name: "Black pepper", amount: 0.25, unit: "tsp", fatsecretFoodId: "88888" },
    ],
    instructions: [
      "Rinse quinoa under cold water and cook according to package instructions (usually 15 minutes).",
      "Season chicken breast with salt, pepper, and half of the lemon juice.",
      "Heat olive oil in a grill pan or skillet over medium-high heat.",
      "Cook chicken for 6-7 minutes per side until internal temperature reaches 165°F.",
      "Let chicken rest for 5 minutes, then slice into strips.",
      "Toss broccoli, bell peppers, and cherry tomatoes with olive oil, garlic, and seasonings.",
      "Roast vegetables at 400°F for 15-20 minutes until tender and slightly charred.",
      "Serve sliced chicken over quinoa with roasted vegetables.",
      "Drizzle remaining lemon juice over the top and serve immediately.",
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold uppercase tracking-wider mb-4">
          Test Feature #128
        </h1>
        <p className="text-muted-foreground mb-8">
          Tap meal card expands to full recipe with ingredients and instructions
        </p>

        {/* Test Instructions */}
        <div className="rounded-lg border border-border bg-card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Test Steps:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click on the meal card below</li>
            <li>Verify expanded view shows full recipe name</li>
            <li>Verify ingredient list is displayed (10 ingredients)</li>
            <li>Verify step-by-step cooking instructions are shown (9 steps)</li>
            <li>Verify detailed nutrition breakdown is visible</li>
          </ol>
        </div>

        {/* Sample Meal Card */}
        <div className="rounded-lg border border-border bg-card p-6 cursor-pointer hover:border-primary/50 transition-colors"
             onClick={() => setSelectedMeal(sampleMeal)}
             data-testid="test-meal-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-md bg-primary/20 px-3 py-1 text-xs font-bold uppercase text-primary">
              {sampleMeal.slot}
            </span>
            <span className="rounded-md bg-green-500/20 px-3 py-1 text-xs font-bold uppercase text-green-500">
              ✓ Verified
            </span>
          </div>

          <h3 className="text-lg font-bold mb-2">{sampleMeal.name}</h3>
          <p className="text-muted-foreground mb-3">{sampleMeal.cuisine}</p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span>🕒</span>
            <span>{sampleMeal.prepTimeMin}m prep + {sampleMeal.cookTimeMin}m cook</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
              {sampleMeal.nutrition.kcal} kcal
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-sm font-bold text-blue-500">
              P {sampleMeal.nutrition.proteinG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-500">
              C {sampleMeal.nutrition.carbsG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-red-500/15 px-3 py-1 text-sm font-bold text-red-500">
              F {sampleMeal.nutrition.fatG}g
            </span>
          </div>
        </div>

        <p className="text-center text-muted-foreground mt-6 text-sm">
          ↑ Click the meal card above to test the modal ↑
        </p>

        {/* Modal */}
        {selectedMeal && (
          <MealDetailModal
            meal={selectedMeal}
            onClose={() => setSelectedMeal(null)}
          />
        )}
      </div>
    </div>
  );
}
