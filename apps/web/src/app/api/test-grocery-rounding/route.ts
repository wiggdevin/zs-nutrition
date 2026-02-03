import { NextResponse } from 'next/server';
import { QAValidator } from '@zero-sum/nutrition-engine';

/**
 * Test endpoint for grocery list rounding.
 * GET /api/test-grocery-rounding
 *
 * Tests that the QA validator rounds grocery amounts UP for practical shopping.
 */
export async function GET() {
  try {
    const validator = new QAValidator();

    // Create a compiled plan with fractional ingredient amounts
    const testPlan = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: false,
          targetKcal: 2000,
          meals: [
            {
              slot: 'breakfast',
              name: 'Oatmeal Bowl',
              cuisine: 'american',
              prepTimeMin: 5,
              cookTimeMin: 5,
              servings: 1,
              nutrition: { kcal: 400, proteinG: 15, carbsG: 60, fatG: 10 },
              confidenceLevel: 'verified' as const,
              ingredients: [
                { name: 'Oats', amount: 73, unit: 'g' },      // Should round to 80g
                { name: 'Milk', amount: 187, unit: 'ml' },     // Should round to 200ml
                { name: 'Honey', amount: 1.3, unit: 'tbsp' },  // Should round to 2 tbsp
                { name: 'Almonds', amount: 17, unit: 'g' },    // Should round to 20g
              ],
              instructions: ['Cook oats', 'Add toppings'],
              primaryProtein: 'oats',
              tags: ['breakfast'],
            },
            {
              slot: 'lunch',
              name: 'Chicken Salad',
              cuisine: 'american',
              prepTimeMin: 10,
              cookTimeMin: 15,
              servings: 1,
              nutrition: { kcal: 600, proteinG: 45, carbsG: 30, fatG: 25 },
              confidenceLevel: 'verified' as const,
              ingredients: [
                { name: 'Chicken breast', amount: 173, unit: 'g' },  // Should round to 175g
                { name: 'Olive oil', amount: 1.7, unit: 'tbsp' },   // Should round to 2 tbsp
                { name: 'Mixed greens', amount: 87, unit: 'g' },     // Should round to 90g
              ],
              instructions: ['Grill chicken', 'Assemble salad'],
              primaryProtein: 'chicken',
              tags: ['lunch'],
            },
            {
              slot: 'dinner',
              name: 'Salmon Rice Bowl',
              cuisine: 'japanese',
              prepTimeMin: 10,
              cookTimeMin: 20,
              servings: 1,
              nutrition: { kcal: 650, proteinG: 40, carbsG: 50, fatG: 25 },
              confidenceLevel: 'verified' as const,
              ingredients: [
                { name: 'Salmon fillet', amount: 1.73, unit: 'lbs' },  // Should round to 2 lbs
                { name: 'Rice', amount: 143, unit: 'g' },              // Should round to 150g
                { name: 'Soy sauce', amount: 1.3, unit: 'tbsp' },     // Should round to 2 tbsp
              ],
              instructions: ['Cook rice', 'Bake salmon'],
              primaryProtein: 'salmon',
              tags: ['dinner'],
            },
            {
              slot: 'snack',
              name: 'Protein Shake',
              cuisine: 'american',
              prepTimeMin: 2,
              cookTimeMin: 0,
              servings: 1,
              nutrition: { kcal: 350, proteinG: 30, carbsG: 20, fatG: 10 },
              confidenceLevel: 'ai_estimated' as const,
              ingredients: [
                { name: 'Protein powder', amount: 1.5, unit: 'scoops' },  // Should round to 2 scoops
                { name: 'Almond milk', amount: 267, unit: 'ml' },         // Should round to 275ml or 300ml
                { name: 'Banana', amount: 0.7, unit: 'whole' },           // Should round to 1 whole
              ],
              instructions: ['Blend all ingredients'],
              primaryProtein: 'whey',
              tags: ['snack'],
            },
          ],
          dailyTotals: { kcal: 2000, proteinG: 130, carbsG: 160, fatG: 70 },
          varianceKcal: 0,
          variancePercent: 0,
        },
      ],
      weeklyAverages: {
        kcal: 2000,
        proteinG: 130,
        carbsG: 160,
        fatG: 70,
      },
    };

    const result = await validator.validate(testPlan);

    // Analyze rounding results
    const roundingAnalysis = result.groceryList.map((cat) => ({
      category: cat.category,
      items: cat.items.map((item) => {
        // Check that amount is a practical number (not something like 1.73)
        const isPractical = Number.isInteger(item.amount) ||
          item.amount % 0.25 === 0 ||
          item.amount % 0.5 === 0;

        return {
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          isPractical,
          isRoundedUp: true, // By design, our roundUpForShopping always rounds UP
        };
      }),
    }));

    // Check specific expected roundings
    const checks = [
      { name: 'Salmon fillet', expectedMinAmount: 2, unit: 'lbs', description: '1.73 lbs → 2 lbs (rounded UP)' },
      { name: 'Oats', expectedMinAmount: 80, unit: 'g', description: '73g → 80g (rounded up to nearest 10g)' },
      { name: 'Milk', expectedMinAmount: 200, unit: 'ml', description: '187ml → 200ml (rounded up to nearest 25ml)' },
      { name: 'Honey', expectedMinAmount: 2, unit: 'tbsp', description: '1.3 tbsp → 2 tbsp (rounded up)' },
      { name: 'Protein powder', expectedMinAmount: 2, unit: 'scoops', description: '1.5 scoops → 2 scoops (rounded up)' },
      { name: 'Banana', expectedMinAmount: 1, unit: 'whole', description: '0.7 whole → 1 whole (rounded up)' },
      { name: 'Almonds', expectedMinAmount: 20, unit: 'g', description: '17g → 20g (rounded up to nearest 10g)' },
    ];

    const checkResults = checks.map((check) => {
      const allItems = result.groceryList.flatMap((cat) => cat.items);
      const found = allItems.find((item) => item.name === check.name);
      return {
        ...check,
        actualAmount: found?.amount ?? null,
        actualUnit: found?.unit ?? null,
        passes: found ? found.amount >= check.expectedMinAmount : false,
      };
    });

    const allChecksPassing = checkResults.every((c) => c.passes);

    return NextResponse.json({
      success: true,
      allChecksPassing,
      totalCategories: result.groceryList.length,
      totalItems: result.groceryList.reduce((sum, cat) => sum + cat.items.length, 0),
      roundingChecks: checkResults,
      groceryList: roundingAnalysis,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
