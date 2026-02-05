/**
 * Generate a REAL meal plan using the 6-agent AI pipeline + FatSecret API
 *
 * This script bypasses the mock data generation and calls the nutrition engine directly.
 * FatSecret API only works from whitelisted IP addresses.
 *
 * Usage: npx tsx generate-real-plan.ts [userEmail]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { NutritionPipelineOrchestrator, RawIntakeForm, PipelineConfig } from '@zero-sum/nutrition-engine';
import { v4 as uuidv4 } from 'uuid';

// Load env from apps/web/.env.local
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(__dirname, 'apps/web/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  }
}

// Use absolute path to database
const dbPath = path.join(__dirname, 'apps/web/prisma/prisma/dev.db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

async function main() {
  const userEmail = process.argv[2];

  console.log('\n============================================================');
  console.log('🧬 REAL MEAL PLAN GENERATION (6-Agent AI Pipeline)');
  console.log('============================================================\n');

  // Validate environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const fatsecretClientId = process.env.FATSECRET_CLIENT_ID;
  const fatsecretClientSecret = process.env.FATSECRET_CLIENT_SECRET;

  console.log('📋 Environment Check:');
  console.log(`   ANTHROPIC_API_KEY: ${anthropicKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   FATSECRET_CLIENT_ID: ${fatsecretClientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   FATSECRET_CLIENT_SECRET: ${fatsecretClientSecret ? '✅ Set' : '❌ Missing'}`);

  if (!anthropicKey || !fatsecretClientId || !fatsecretClientSecret) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Please ensure apps/web/.env.local has all required variables.');
    process.exit(1);
  }

  // Find user
  let user;
  if (userEmail) {
    user = await prisma.user.findFirst({
      where: { email: userEmail },
      include: { profiles: { where: { isActive: true }, take: 1 } },
    });
  } else {
    // Get most recent user with a profile
    user = await prisma.user.findFirst({
      where: { profiles: { some: { isActive: true } } },
      include: { profiles: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!user) {
    console.error('\n❌ No user found! Run the E2E test first to create a user.');
    process.exit(1);
  }

  const profile = user.profiles[0];
  if (!profile) {
    console.error('\n❌ User has no active profile! Complete onboarding first.');
    process.exit(1);
  }

  console.log(`\n👤 User: ${user.email}`);
  console.log(`   Name: ${profile.name}`);
  console.log(`   Goal: ${profile.goalType}`);
  console.log(`   Activity: ${profile.activityLevel}`);
  console.log(`   Dietary: ${profile.dietaryStyle}`);

  // Parse JSON fields
  const allergies = profile.allergies ? JSON.parse(profile.allergies) : [];
  const exclusions = profile.exclusions ? JSON.parse(profile.exclusions) : [];
  const cuisinePreferences = profile.cuisinePreferences ? JSON.parse(profile.cuisinePreferences) : [];
  const trainingDays = profile.trainingDays ? JSON.parse(profile.trainingDays) : ['monday', 'wednesday', 'friday'];

  // Convert profile to RawIntakeForm
  const intakeForm: RawIntakeForm = {
    name: profile.name,
    sex: profile.sex as 'male' | 'female',
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPct || undefined,
    goalType: profile.goalType as 'cut' | 'maintain' | 'bulk',
    goalRate: profile.goalRate || 1,
    activityLevel: profile.activityLevel as 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active',
    trainingDays: trainingDays,
    trainingTime: (profile.trainingTime as 'morning' | 'afternoon' | 'evening') || undefined,
    dietaryStyle: profile.dietaryStyle as 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo',
    allergies,
    exclusions,
    cuisinePreferences,
    mealsPerDay: profile.mealsPerDay || 3,
    snacksPerDay: profile.snacksPerDay || 1,
    cookingSkill: profile.cookingSkill || 5,
    prepTimeMaxMin: profile.prepTimeMax || 30,
    macroStyle: profile.macroStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto',
    planDurationDays: 7,
  };

  console.log('\n📊 Intake Form:');
  console.log(JSON.stringify(intakeForm, null, 2));

  // Create pipeline
  const config: PipelineConfig = {
    anthropicApiKey: anthropicKey,
    fatsecretClientId,
    fatsecretClientSecret,
  };

  const orchestrator = new NutritionPipelineOrchestrator(config);

  console.log('\n🚀 Starting 6-Agent Pipeline...\n');
  console.log('   Agent 1: Intake Normalizer');
  console.log('   Agent 2: Metabolic Calculator');
  console.log('   Agent 3: Recipe Curator (Claude AI)');
  console.log('   Agent 4: Nutrition Compiler (FatSecret API)');
  console.log('   Agent 5: QA Validator');
  console.log('   Agent 6: Brand Renderer');
  console.log('\n');

  const startTime = Date.now();

  const result = await orchestrator.run(intakeForm, (progress) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${elapsed}s] Agent ${progress.agent} (${progress.agentName}): ${progress.message}`);
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!result.success) {
    console.error(`\n❌ Pipeline failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`\n✅ Pipeline completed in ${totalTime}s!\n`);

  // Show plan summary
  const plan = result.plan!;
  console.log('📋 Plan Summary:');
  console.log(`   Days: ${plan.days.length}`);
  console.log(`   Weekly Avg Kcal: ${plan.weeklyTotals.avgKcal}`);
  console.log(`   Weekly Avg Protein: ${plan.weeklyTotals.avgProteinG}g`);
  console.log(`   QA Status: ${plan.qa.status} (Score: ${plan.qa.score})`);

  console.log('\n📅 Daily Breakdown:');
  for (const day of plan.days) {
    console.log(`\n   ${day.dayName} (Day ${day.dayNumber})${day.isTrainingDay ? ' 🏋️' : ''}:`);
    console.log(`   Target: ${day.targetKcal} kcal | Actual: ${day.dailyTotals.kcal} kcal (${day.variancePercent.toFixed(1)}% variance)`);
    for (const meal of day.meals) {
      console.log(`      ${meal.slot}: ${meal.name} (${meal.nutrition.kcal} kcal, ${meal.nutrition.proteinG}g protein)`);
    }
  }

  // Save to database
  console.log('\n💾 Saving plan to database...');

  // Deactivate any existing plans for this user
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  // Extract base goal and training bonus from the plan's per-day targets
  // Rest days have the base targetKcal, training days have base + bonus
  const restDay = plan.days.find(d => !d.isTrainingDay);
  const trainingDay = plan.days.find(d => d.isTrainingDay);
  const baseGoalKcal = restDay?.targetKcal || Math.round(plan.weeklyTotals.avgKcal);
  const trainingBonusKcal = trainingDay && restDay
    ? trainingDay.targetKcal - restDay.targetKcal
    : 200;

  // Create the meal plan record using correct schema fields
  // dailyKcalTarget should be the BASE goal (rest day target), not the average
  const savedPlan = await prisma.mealPlan.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(plan),
      metabolicProfile: JSON.stringify(result.deliverables || {}),
      dailyKcalTarget: baseGoalKcal,
      dailyProteinG: Math.round(plan.weeklyTotals.avgProteinG),
      dailyCarbsG: Math.round(plan.weeklyTotals.avgCarbsG),
      dailyFatG: Math.round(plan.weeklyTotals.avgFatG),
      trainingBonusKcal: trainingBonusKcal,
      planDays: plan.days.length,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: plan.qa.score,
      qaStatus: plan.qa.status,
      isActive: true,
      status: 'active',
    },
  });

  console.log(`   ✅ Plan saved with ID: ${savedPlan.id}`);

  // Summary
  console.log('\n============================================================');
  console.log('🎉 REAL MEAL PLAN GENERATION COMPLETE');
  console.log('============================================================');
  console.log(`\nUser: ${user.email}`);
  console.log(`Plan ID: ${savedPlan.id}`);
  console.log(`\nOpen http://localhost:3456/dashboard to see your plan!`);
  console.log('\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
