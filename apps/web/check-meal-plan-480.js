/**
 * Check the meal plan data for Feature #480
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMealPlan() {
  console.log('='.repeat(60));
  console.log('Checking Meal Plan for Feature #480');
  console.log('='.repeat(60));
  console.log();

  try {
    // Find the test user's most recent meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        user: {
          email: 'feature-480-keto-test@example.com'
        }
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    if (!mealPlan) {
      console.log('❌ No meal plan found');
      return;
    }

    console.log('✅ Meal Plan found');
    console.log('Plan ID:', mealPlan.id);
    console.log('Created:', mealPlan.createdAt);
    console.log();

    console.log('PLAN TARGETS:');
    console.log('-'.repeat(60));
    console.log('Calories:', mealPlan.dailyKcalTarget, 'kcal');
    console.log('Protein:', mealPlan.dailyProteinG, 'g');
    console.log('Carbs:', mealPlan.dailyCarbsG, 'g');
    console.log('Fat:', mealPlan.dailyFatG, 'g');
    console.log();

    // Parse metabolic profile JSON
    const metabolic = JSON.parse(mealPlan.metabolicProfile);
    console.log('METABOLIC PROFILE (JSON):');
    console.log('-'.repeat(60));
    console.log('Goal Calories:', metabolic.goalKcal);
    console.log('Protein Target:', metabolic.proteinTargetG, 'g');
    console.log('Carbs Target:', metabolic.carbsTargetG, 'g');
    console.log('Fat Target:', metabolic.fatTargetG, 'g');
    console.log();

    // Use metabolic profile values for calculations
    const goalKcal = metabolic.goalKcal || mealPlan.dailyKcalTarget;
    const proteinG = metabolic.proteinTargetG || mealPlan.dailyProteinG;
    const carbsG = metabolic.carbsTargetG || mealPlan.dailyCarbsG;
    const fatG = metabolic.fatTargetG || mealPlan.dailyFatG;

    // Calculate percentages
    const proteinKcal = proteinG * 4;
    const carbsKcal = carbsG * 4;
    const fatKcal = fatG * 9;

    console.log('CALCULATED MACRO PERCENTAGES:');
    console.log('-'.repeat(60));
    console.log('Protein:', (proteinKcal / goalKcal * 100).toFixed(1) + '%');
    console.log('Carbs:', (carbsKcal / goalKcal * 100).toFixed(1) + '%');
    console.log('Fat:', (fatKcal / goalKcal * 100).toFixed(1) + '%');
    console.log();

    // Check first few meals - need to parse validatedPlan
    console.log('SAMPLE MEALS (from validated plan):');
    console.log('-'.repeat(60));
    const validated = JSON.parse(mealPlan.validatedPlan);
    if (validated.days && validated.days.length > 0) {
      const firstDay = validated.days[0];
      console.log(`Day: ${firstDay.day}`);
      if (firstDay.meals) {
        firstDay.meals.slice(0, 3).forEach((meal, idx) => {
          console.log(`  Meal ${idx + 1}: ${meal.name}`);
          console.log(`    ${meal.kcal} kcal | P:${meal.proteinG}g C:${meal.carbsG}g F:${meal.fatG}g`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMealPlan();
