/**
 * Seed test user with meal plan and open dashboard
 * Uses the same database as the dev server
 */

import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import {
  NutritionPipelineOrchestrator,
  PipelineConfig,
} from './packages/nutrition-engine/src/orchestrator';
import { RawIntakeForm } from './packages/nutrition-engine/src/types/schemas';
import * as path from 'path';

// Load environment
const dotenv = require('dotenv');
dotenv.config({ path: './apps/web/.env' });

// Use the same database as the dev server
const dbPath = path.resolve(__dirname, 'apps/web/prisma/dev.db');
console.log('Using database:', dbPath);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

const FATSECRET_CLIENT_ID = process.env.FATSECRET_CLIENT_ID || '';
const FATSECRET_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEV_SERVER_URL = 'http://localhost:3456';
const TEST_EMAIL = 'fatsecret-test@zsnutrition.test';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🍽️  ZS-MAC: Seed & Open Dashboard');
  console.log('='.repeat(60));

  // Step 1: Create or find test user
  console.log('\n📋 Step 1: Setting up test user...');

  const clerkUserId = 'test_user_fatsecret_001';
  let user = await prisma.user.findUnique({ where: { clerkUserId } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email: TEST_EMAIL,
      },
    });
    console.log('   ✅ Created new test user:', user.id);
  } else {
    console.log('   ✅ Found existing test user:', user.id);
  }

  // Step 2: Create user profile
  console.log('\n📋 Step 2: Setting up user profile...');

  let profile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'FatSecret Test User',
        sex: 'male',
        age: 30,
        heightCm: 177.8,
        weightKg: 81.6,
        bodyFatPercent: 18,
        goalType: 'cut',
        goalRate: 0.75,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        allergies: '[]',
        exclusions: '[]',
        cuisinePrefs: '["american", "mediterranean"]',
        trainingDays: '["monday", "tuesday", "thursday", "friday"]',
        trainingTime: 'evening',
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 6,
        prepTimeMax: 45,
        macroStyle: 'high_protein',
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 180,
        carbsTargetG: 150,
        fatTargetG: 70,
        isActive: true,
      },
    });
    console.log('   ✅ Created new profile:', profile.id);
  } else {
    console.log('   ✅ Found existing profile:', profile.id);
  }

  // Step 3: Run pipeline and create meal plan
  console.log('\n📋 Step 3: Running meal generation pipeline...');

  const testIntake: RawIntakeForm = {
    name: 'FatSecret Test User',
    sex: 'male',
    age: 30,
    heightFeet: 5,
    heightInches: 10,
    weightLbs: 180,
    bodyFatPercent: 18,
    goalType: 'cut',
    goalRate: 0.75,
    activityLevel: 'moderately_active',
    trainingDays: ['monday', 'tuesday', 'thursday', 'friday'],
    trainingTime: 'evening',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: ['american', 'mediterranean'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    macroStyle: 'high_protein',
    cookingSkill: 6,
    prepTimeMaxMin: 45,
    planDurationDays: 7,
  };

  const config: PipelineConfig = {
    anthropicApiKey: ANTHROPIC_API_KEY,
    fatsecretClientId: FATSECRET_CLIENT_ID,
    fatsecretClientSecret: FATSECRET_CLIENT_SECRET,
    usdaApiKey: process.env.USDA_API_KEY || undefined,
  };

  const orchestrator = new NutritionPipelineOrchestrator(config);

  const pipelineResult = await orchestrator.run(testIntake, (progress) => {
    const statusIcon =
      progress.status === 'completed' ? '✅' : progress.status === 'failed' ? '❌' : '⏳';
    console.log(
      `   ${statusIcon} [Agent ${progress.agent}] ${progress.agentName}: ${progress.message}`
    );
  });

  if (!pipelineResult.success || !pipelineResult.plan) {
    console.error('\n❌ Pipeline failed:', pipelineResult.error);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n   ✅ Pipeline completed!');

  // Step 4: Save meal plan
  console.log('\n📋 Step 4: Saving meal plan...');

  await prisma.mealPlan.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false, status: 'replaced' },
  });

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(pipelineResult.plan),
      metabolicProfile: JSON.stringify({}),
      dailyKcalTarget: 2000,
      dailyProteinG: 180,
      dailyCarbsG: 150,
      dailyFatG: 70,
      trainingBonusKcal: 200,
      planDays: 7,
      startDate,
      endDate,
      qaScore: 90,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
    },
  });

  console.log('   ✅ Meal plan saved:', mealPlan.id);

  // Step 5: Complete onboarding
  console.log('\n📋 Step 5: Completing onboarding...');

  await prisma.onboardingState.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentStep: 6,
      completed: true,
      stepData: JSON.stringify(testIntake),
    },
    update: {
      currentStep: 6,
      completed: true,
    },
  });

  console.log('   ✅ Onboarding complete');

  await prisma.$disconnect();

  // Step 6: Open browser
  console.log('\n📋 Step 6: Opening dashboard...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Sign in
  console.log('   Signing in...');
  const response = await page.request.post(DEV_SERVER_URL + '/api/dev-auth/signin', {
    data: { email: TEST_EMAIL, redirectUrl: '/dashboard' },
  });

  const result = await response.json();
  if (!result.success) {
    console.error('   ❌ Sign in failed:', result.error);
    await browser.close();
    process.exit(1);
  }
  console.log('   ✅ Signed in');

  // Open dashboard
  await page.goto(DEV_SERVER_URL + '/dashboard');
  console.log('   ✅ Dashboard opened');

  // Open meal plan
  const mealPlanPage = await context.newPage();
  await mealPlanPage.goto(DEV_SERVER_URL + '/meal-plan');
  console.log('   ✅ Meal plan opened');

  console.log('\n' + '='.repeat(60));
  console.log('✅ READY - Dashboard is open with generated meal plan');
  console.log('   Plan ID: ' + mealPlan.id);
  console.log('   Press Ctrl+C to close');
  console.log('='.repeat(60));

  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      console.log('\n🛑 Closing...');
      resolve(undefined);
    });
  });

  await browser.close();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
