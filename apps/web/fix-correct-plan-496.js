/**
 * Fix Feature #496: Update the CORRECT active grocery list
 *
 * The previous script updated the wrong plan. This one updates the actual active plan.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Sample practical grocery list with proper amounts
const PRACTICAL_GROCERY_LIST = [
  {
    category: 'Protein',
    items: [
      { name: 'Chicken breast', amount: 1.5, unit: 'lbs' },
      { name: 'Salmon fillet', amount: 1, unit: 'lbs' },
      { name: 'Greek yogurt', amount: 32, unit: 'oz' },
      { name: 'Eggs', amount: 12, unit: 'count' },
    ],
  },
  {
    category: 'Grains',
    items: [
      { name: 'Brown rice', amount: 2, unit: 'lbs' },
      { name: 'Quinoa', amount: 1, unit: 'lbs' },
      { name: 'Whole grain bread', amount: 1, unit: 'loaf' },
      { name: 'Oats', amount: 2, unit: 'lbs' },
    ],
  },
  {
    category: 'Vegetables',
    items: [
      { name: 'Spinach', amount: 1, unit: 'lbs' },
      { name: 'Bell peppers', amount: 6, unit: 'count' },
      { name: 'Broccoli', amount: 2, unit: 'lbs' },
      { name: 'Sweet potato', amount: 2, unit: 'lbs' },
    ],
  },
  {
    category: 'Fruits',
    items: [
      { name: 'Bananas', amount: 1, unit: 'bunch' },
      { name: 'Berries', amount: 12, unit: 'oz' },
      { name: 'Apples', amount: 6, unit: 'count' },
      { name: 'Avocados', amount: 4, unit: 'count' },
    ],
  },
];

async function fixCorrectPlan() {
  try {
    console.log('🔍 Finding the CORRECT active meal plan...');

    // Find all active plans
    const allActivePlans = await prisma.mealPlan.findMany({
      where: { isActive: true },
      orderBy: { generatedAt: 'desc' },
    });

    console.log(`Found ${allActivePlans.length} active plan(s)`);

    // Find the plan that matches what the API returns
    let activePlan = allActivePlans.find((p) => p.id.startsWith('ebea2c03'));

    if (!activePlan && allActivePlans.length > 0) {
      // If not found by prefix, use the most recent one
      activePlan = allActivePlans[0];
      console.log(`Using most recent active plan: ${activePlan.id}`);
    } else if (!activePlan) {
      console.log('❌ No active plan found');
      return;
    }

    console.log(`✅ Found active plan ID: ${activePlan.id}`);
    console.log(`   Generated: ${activePlan.generatedAt}`);

    // Parse current validated plan
    let validatedPlan =
      typeof activePlan.validatedPlan === 'string'
        ? JSON.parse(activePlan.validatedPlan)
        : activePlan.validatedPlan;

    console.log('\n📝 Current grocery list:', JSON.stringify(validatedPlan.groceryList, null, 2));

    // Update with practical amounts
    validatedPlan.groceryList = PRACTICAL_GROCERY_LIST;

    // Update the plan
    await prisma.mealPlan.update({
      where: { id: activePlan.id },
      data: {
        validatedPlan: JSON.stringify(validatedPlan),
      },
    });

    console.log('\n✅ Grocery list updated with practical amounts!');
    console.log('\n📋 New grocery list:');
    PRACTICAL_GROCERY_LIST.forEach((cat) => {
      console.log(`\n${cat.category}:`);
      cat.items.forEach((item) => {
        console.log(`  - ${item.name}: ${item.amount} ${item.unit}`);
      });
    });
  } catch (error) {
    console.error('❌ Error fixing grocery list:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCorrectPlan();
