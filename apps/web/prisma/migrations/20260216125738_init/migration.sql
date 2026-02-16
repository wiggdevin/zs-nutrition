-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "stepData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPercent" DOUBLE PRECISION,
    "goalType" TEXT NOT NULL,
    "goalRate" DOUBLE PRECISION NOT NULL,
    "activityLevel" TEXT NOT NULL,
    "dietaryStyle" TEXT NOT NULL,
    "allergies" JSONB,
    "exclusions" JSONB,
    "cuisinePrefs" JSONB,
    "trainingDays" JSONB,
    "trainingTime" TEXT,
    "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
    "snacksPerDay" INTEGER NOT NULL DEFAULT 1,
    "cookingSkill" INTEGER NOT NULL DEFAULT 5,
    "prepTimeMax" INTEGER NOT NULL DEFAULT 30,
    "macroStyle" TEXT NOT NULL DEFAULT 'balanced',
    "bmrKcal" INTEGER,
    "tdeeKcal" INTEGER,
    "goalKcal" INTEGER,
    "proteinTargetG" INTEGER,
    "carbsTargetG" INTEGER,
    "fatTargetG" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "validatedPlan" JSONB,
    "metabolicProfile" JSONB,
    "dailyKcalTarget" INTEGER,
    "dailyProteinG" INTEGER,
    "dailyCarbsG" INTEGER,
    "dailyFatG" INTEGER,
    "trainingBonusKcal" INTEGER,
    "planDays" INTEGER NOT NULL DEFAULT 7,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "qaScore" INTEGER,
    "qaStatus" TEXT,
    "pdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSwap" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "originalMeal" JSONB NOT NULL,
    "newMeal" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanGenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentAgent" INTEGER,
    "progress" JSONB,
    "intakeData" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "targetKcal" INTEGER,
    "targetProteinG" INTEGER,
    "targetCarbsG" INTEGER,
    "targetFatG" INTEGER,
    "actualKcal" INTEGER NOT NULL DEFAULT 0,
    "actualProteinG" INTEGER NOT NULL DEFAULT 0,
    "actualCarbsG" INTEGER NOT NULL DEFAULT 0,
    "actualFatG" INTEGER NOT NULL DEFAULT 0,
    "adherenceScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "loggedDate" TIMESTAMP(3) NOT NULL,
    "mealSlot" TEXT,
    "mealName" TEXT NOT NULL,
    "portion" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "kcal" INTEGER NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "fiberG" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "fatsecretId" TEXT,
    "photoUrl" TEXT,
    "scanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "analysisResult" JSONB,
    "adjustedResult" JSONB,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FoodScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "weightLbs" DOUBLE PRECISION NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalorieAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousGoalKcal" INTEGER NOT NULL,
    "newGoalKcal" INTEGER NOT NULL,
    "adjustmentReason" JSONB NOT NULL,
    "weightChangeKg" DOUBLE PRECISION,
    "weightChangeLbs" DOUBLE PRECISION,
    "trendAnalysis" JSONB,
    "milestoneAchieved" TEXT,
    "planRegenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalorieAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "platformUserId" TEXT,
    "scope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "syncDate" TIMESTAMP(3) NOT NULL,
    "steps" INTEGER,
    "activeCalories" DOUBLE PRECISION,
    "totalCalories" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "distanceMiles" DOUBLE PRECISION,
    "activeMinutes" INTEGER,
    "workoutCount" INTEGER,
    "workouts" JSONB,
    "sleepMinutes" INTEGER,
    "sleepScore" INTEGER,
    "heartRateAvg" DOUBLE PRECISION,
    "heartRateMax" INTEGER,
    "rawSyncData" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ActivitySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingState_userId_key" ON "OnboardingState"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_isActive_idx" ON "UserProfile"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MealPlan_userId_isActive_idx" ON "MealPlan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MealPlan_userId_status_isActive_idx" ON "MealPlan"("userId", "status", "isActive");

-- CreateIndex
CREATE INDEX "MealPlan_userId_isActive_deletedAt_idx" ON "MealPlan"("userId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "MealSwap_mealPlanId_dayNumber_slot_idx" ON "MealSwap"("mealPlanId", "dayNumber", "slot");

-- CreateIndex
CREATE INDEX "PlanGenerationJob_userId_status_idx" ON "PlanGenerationJob"("userId", "status");

-- CreateIndex
CREATE INDEX "PlanGenerationJob_createdAt_idx" ON "PlanGenerationJob"("createdAt");

-- CreateIndex
CREATE INDEX "DailyLog_userId_date_idx" ON "DailyLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_userId_date_key" ON "DailyLog"("userId", "date");

-- CreateIndex
CREATE INDEX "TrackedMeal_userId_loggedDate_idx" ON "TrackedMeal"("userId", "loggedDate");

-- CreateIndex
CREATE INDEX "TrackedMeal_loggedDate_idx" ON "TrackedMeal"("loggedDate");

-- CreateIndex
CREATE INDEX "TrackedMeal_source_idx" ON "TrackedMeal"("source");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedMeal_userId_mealPlanId_loggedDate_mealSlot_source_key" ON "TrackedMeal"("userId", "mealPlanId", "loggedDate", "mealSlot", "source");

-- CreateIndex
CREATE INDEX "FoodScan_userId_idx" ON "FoodScan"("userId");

-- CreateIndex
CREATE INDEX "FoodScan_status_idx" ON "FoodScan"("status");

-- CreateIndex
CREATE INDEX "WeightEntry_userId_logDate_idx" ON "WeightEntry"("userId", "logDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_userId_logDate_key" ON "WeightEntry"("userId", "logDate");

-- CreateIndex
CREATE INDEX "CalorieAdjustment_userId_createdAt_idx" ON "CalorieAdjustment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FitnessConnection_userId_platform_isActive_idx" ON "FitnessConnection"("userId", "platform", "isActive");

-- CreateIndex
CREATE INDEX "FitnessConnection_lastSyncAt_idx" ON "FitnessConnection"("lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessConnection_userId_platform_key" ON "FitnessConnection"("userId", "platform");

-- CreateIndex
CREATE INDEX "ActivitySync_userId_syncDate_idx" ON "ActivitySync"("userId", "syncDate");

-- CreateIndex
CREATE INDEX "ActivitySync_connectionId_syncDate_idx" ON "ActivitySync"("connectionId", "syncDate");

-- CreateIndex
CREATE INDEX "ActivitySync_processed_idx" ON "ActivitySync"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySync_connectionId_syncDate_key" ON "ActivitySync"("connectionId", "syncDate");

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwap" ADD CONSTRAINT "MealSwap_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanGenerationJob" ADD CONSTRAINT "PlanGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedMeal" ADD CONSTRAINT "TrackedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedMeal" ADD CONSTRAINT "TrackedMeal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodScan" ADD CONSTRAINT "FoodScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieAdjustment" ADD CONSTRAINT "CalorieAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessConnection" ADD CONSTRAINT "FitnessConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySync" ADD CONSTRAINT "ActivitySync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySync" ADD CONSTRAINT "ActivitySync_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "FitnessConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
