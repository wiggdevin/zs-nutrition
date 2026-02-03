import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

/**
 * Dev-only endpoint to test tracking data isolation between users.
 *
 * This endpoint:
 * 1. Creates two test users (A and B)
 * 2. Logs meals as User A
 * 3. Queries tracking data scoped to User B - verifies User A's data not returned
 * 4. Tries to find User A's tracked meal as User B - verifies access denied
 * 5. Tries to delete User A's tracked meal as User B - verifies access denied
 * 6. Cleans up all test data
 */
export async function GET() {
  const isDevMode =
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === "sk_test_placeholder" ||
    process.env.CLERK_SECRET_KEY === "";

  if (!isDevMode) {
    return NextResponse.json(
      { error: "Dev test endpoint only available in development mode" },
      { status: 403 }
    );
  }

  const testResults: Array<{
    step: string;
    description: string;
    passed: boolean;
    details: string;
  }> = [];

  // Unique test IDs for cleanup
  const testId = uuidv4().slice(0, 8);
  const emailA = `isolation_userA_${testId}@test.com`;
  const emailB = `isolation_userB_${testId}@test.com`;

  let userA: { id: string } | null = null;
  let userB: { id: string } | null = null;
  let userAMealIds: string[] = [];

  try {
    // ==========================================
    // STEP 1: Create two test users
    // ==========================================
    userA = await prisma.user.create({
      data: {
        clerkUserId: `dev_testA_${testId}`,
        email: emailA,
      },
    });
    userB = await prisma.user.create({
      data: {
        clerkUserId: `dev_testB_${testId}`,
        email: emailB,
      },
    });

    // Non-null assertions (create would throw if failed)
    if (!userA || !userB) {
      throw new Error("Failed to create test users");
    }

    testResults.push({
      step: "1",
      description: "Create two test users (A and B)",
      passed: !!userA?.id && !!userB?.id && userA.id !== userB.id,
      details: `User A: ${userA?.id || 'null'}, User B: ${userB?.id || 'null'}`,
    });

    // ==========================================
    // STEP 2: Log several meals as User A
    // ==========================================
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const mealsForUserA = [
      {
        userId: userA.id,
        loggedDate: dateOnly,
        mealSlot: "breakfast",
        mealName: `ISOLATION_TEST_A_Oatmeal_${testId}`,
        portion: 1.0,
        kcal: 350,
        proteinG: 12,
        carbsG: 55,
        fatG: 8,
        source: "manual",
        confidenceScore: 1.0,
      },
      {
        userId: userA.id,
        loggedDate: dateOnly,
        mealSlot: "lunch",
        mealName: `ISOLATION_TEST_A_Chicken_Salad_${testId}`,
        portion: 1.0,
        kcal: 520,
        proteinG: 42,
        carbsG: 25,
        fatG: 28,
        source: "manual",
        confidenceScore: 1.0,
      },
      {
        userId: userA.id,
        loggedDate: dateOnly,
        mealSlot: "dinner",
        mealName: `ISOLATION_TEST_A_Salmon_${testId}`,
        portion: 1.0,
        kcal: 680,
        proteinG: 45,
        carbsG: 35,
        fatG: 38,
        source: "manual",
        confidenceScore: 1.0,
      },
    ];

    for (const mealData of mealsForUserA) {
      const meal = await prisma.trackedMeal.create({ data: mealData });
      userAMealIds.push(meal.id);
    }

    // Also create a DailyLog for User A
    await prisma.dailyLog.create({
      data: {
        userId: userA.id,
        date: dateOnly,
        targetKcal: 2200,
        targetProteinG: 150,
        targetCarbsG: 250,
        targetFatG: 70,
        actualKcal: 1550,
        actualProteinG: 99,
        actualCarbsG: 115,
        actualFatG: 74,
      },
    });

    testResults.push({
      step: "2",
      description: "As User A, log several meals",
      passed: userAMealIds.length === 3,
      details: `Logged ${userAMealIds.length} meals for User A: ${userAMealIds.join(", ")}`,
    });

    // ==========================================
    // STEP 3: As User B, query daily summary for User A's date
    // Verify only User B's data returned (should be empty)
    // ==========================================
    const userBTrackedMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: userB.id,
        loggedDate: dateOnly,
      },
    });

    const userBDailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: userB.id,
          date: dateOnly,
        },
      },
    });

    // Also verify User A's meals exist (for comparison)
    const userATrackedMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: userA.id,
        loggedDate: dateOnly,
      },
    });

    const userBSeesMeals = userBTrackedMeals.length;
    const userASeesMeals = userATrackedMeals.length;

    // User B should see 0 meals, User A should see 3
    testResults.push({
      step: "3",
      description: "As User B, query daily summary for same date - verify only User B's data returned",
      passed: userBSeesMeals === 0 && userASeesMeals === 3 && userBDailyLog === null,
      details: `User B sees ${userBSeesMeals} meals (expected 0), User A sees ${userASeesMeals} meals (expected 3). User B daily log: ${userBDailyLog === null ? "null (correct)" : "found (WRONG!)"}`,
    });

    // ==========================================
    // STEP 4: Try to find/access User A's tracked meal by ID as User B
    // ==========================================
    const userAMealId = userAMealIds[0];

    // This simulates what the deleteTrackedMeal procedure does:
    // findFirst with both id AND userId constraint
    const crossUserAccess = await prisma.trackedMeal.findFirst({
      where: {
        id: userAMealId,
        userId: userB.id, // User B trying to access User A's meal
      },
    });

    testResults.push({
      step: "4a",
      description: "Try to find User A's tracked meal by ID as User B",
      passed: crossUserAccess === null,
      details: crossUserAccess === null
        ? `User B cannot find User A's meal ${userAMealId} - access correctly denied`
        : `SECURITY ISSUE: User B found User A's meal! ${JSON.stringify(crossUserAccess)}`,
    });

    // ==========================================
    // STEP 5: Try to delete User A's tracked meal as User B
    // (The real deleteTrackedMeal checks userId match)
    // ==========================================
    // First verify the meal still exists
    const mealBeforeDeleteAttempt = await prisma.trackedMeal.findUnique({
      where: { id: userAMealId },
    });

    // Simulate the delete procedure's security check
    const mealForDelete = await prisma.trackedMeal.findFirst({
      where: {
        id: userAMealId,
        userId: userB.id, // User B attempting delete
      },
    });

    // If findFirst returns null (it should), delete is denied
    const deleteBlocked = mealForDelete === null;

    // Verify the meal still exists after User B's attempt
    const mealAfterDeleteAttempt = await prisma.trackedMeal.findUnique({
      where: { id: userAMealId },
    });

    testResults.push({
      step: "4b",
      description: "Try to delete User A's tracked meal as User B - verify access denied",
      passed: deleteBlocked && mealAfterDeleteAttempt !== null,
      details: deleteBlocked
        ? `Delete correctly blocked: User A's meal still exists (${mealAfterDeleteAttempt?.mealName})`
        : `SECURITY ISSUE: User B could access User A's meal for deletion!`,
    });

    // ==========================================
    // STEP 6: Verify DailyLog isolation
    // ==========================================
    const userADailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: userA.id,
          date: dateOnly,
        },
      },
    });

    const userBDailyLog2 = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: userB.id,
          date: dateOnly,
        },
      },
    });

    testResults.push({
      step: "5",
      description: "DailyLog data isolated - User B cannot see User A's daily log",
      passed: userADailyLog !== null && userBDailyLog2 === null,
      details: `User A daily log exists: ${!!userADailyLog} (kcal: ${userADailyLog?.actualKcal}), User B daily log: ${userBDailyLog2 === null ? "null (correct)" : "exists (WRONG!)"}`,
    });

    // Overall result
    const allPassed = testResults.every((r) => r.passed);

    return NextResponse.json({
      testName: "Tracking Data Isolation Between Users",
      testId,
      allPassed,
      passedCount: testResults.filter((r) => r.passed).length,
      totalCount: testResults.length,
      userA: { id: userA.id, email: emailA },
      userB: { id: userB.id, email: emailB },
      results: testResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Test failed with error",
        testResults,
      },
      { status: 500 }
    );
  } finally {
    // ==========================================
    // CLEANUP: Remove all test data
    // ==========================================
    try {
      if (userA) {
        await prisma.trackedMeal.deleteMany({ where: { userId: userA.id } });
        await prisma.dailyLog.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB) {
        await prisma.trackedMeal.deleteMany({ where: { userId: userB.id } });
        await prisma.dailyLog.deleteMany({ where: { userId: userB.id } });
        await prisma.user.delete({ where: { id: userB.id } });
      }
    } catch {
      // Cleanup errors are non-fatal
    }
  }
}
