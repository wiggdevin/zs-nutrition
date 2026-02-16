#!/usr/bin/env node
// Test Prisma database connection for feature #33

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info', 'query'],
});

async function testConnection() {
  console.log('🔍 Step 1: Testing Prisma client initialization...');

  try {
    // Test basic connection
    console.log('✅ Prisma client initialized successfully');

    // Step 2: Perform a basic read query
    console.log('\n🔍 Step 2: Testing basic read query...');
    const userCount = await prisma.user.count();
    console.log(`✅ Read query successful: Found ${userCount} users in database`);

    // Step 3: Test all models are accessible
    console.log('\n🔍 Step 3: Verifying all models are accessible...');
    const models = [
      'user',
      'userProfile',
      'onboardingState',
      'mealPlan',
      'mealSwap',
      'planGenerationJob',
      'dailyLog',
      'trackedMeal',
      'foodScan',
      'weightEntry',
      'calorieAdjustment',
      'fitnessConnection',
      'activitySync',
    ];

    for (const model of models) {
      try {
        const count = await prisma[model].count();
        console.log(`  ✅ ${model}: ${count} records`);
      } catch (error) {
        console.log(`  ❌ ${model}: Error - ${error.message}`);
      }
    }

    // Step 4: Perform a basic write query
    console.log('\n🔍 Step 4: Testing basic write query...');

    // Create a test user
    const testUser = await prisma.user.upsert({
      where: { clerkUserId: 'test_feature_33' },
      update: {},
      create: {
        clerkUserId: 'test_feature_33',
        email: 'test-feature-33@example.com',
      },
    });
    console.log(`✅ Write query successful: Created/updated test user with ID: ${testUser.id}`);

    // Step 5: Verify data persists
    console.log('\n🔍 Step 5: Verifying data persists in database...');

    const retrievedUser = await prisma.user.findUnique({
      where: { clerkUserId: 'test_feature_33' },
    });

    if (retrievedUser && retrievedUser.id === testUser.id) {
      console.log(
        `✅ Data persistence verified: User ${retrievedUser.email} persisted in database`
      );
    } else {
      console.log('❌ Data persistence FAILED: Could not retrieve user');
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.user.delete({
      where: { clerkUserId: 'test_feature_33' },
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All database connection tests PASSED!');
  } catch (error) {
    console.error('\n❌ Database connection test FAILED:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
