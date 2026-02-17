import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { decompressJson } from '@/lib/compression';

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface PlanMeal {
  slot: string;
  name: string;
  nutrition: MealNutrition;
}

interface PlanDay {
  dayNumber: number;
  dayName: string;
  targetKcal: number;
  meals: PlanMeal[];
}

interface ValidatedPlan {
  days: PlanDay[];
}

interface MealChange {
  slot: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  nameA?: string;
  nameB?: string;
  nutritionA?: MealNutrition;
  nutritionB?: MealNutrition;
}

interface DayDiff {
  dayNumber: number;
  dayName: string;
  kcalDiff: number;
  targetKcalA: number;
  targetKcalB: number;
  meals: MealChange[];
}

/**
 * GET /api/plan/diff?planA={id}&planB={id}
 *
 * Compares two plan versions and returns structured differences.
 * Both plans must belong to the current user.
 */
export async function GET(request: NextRequest) {
  try {
    let clerkUserId: string;
    try {
      ({ clerkUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const planAId = searchParams.get('planA');
    const planBId = searchParams.get('planB');

    if (!planAId || !planBId) {
      return NextResponse.json(
        { error: 'Both planA and planB query params are required' },
        { status: 400 }
      );
    }

    if (planAId === planBId) {
      return NextResponse.json({ error: 'Cannot compare a plan to itself' }, { status: 400 });
    }

    // Fetch both plans - ensure they belong to this user
    const [planA, planB] = await Promise.all([
      prisma.mealPlan.findFirst({
        where: { id: planAId, userId: user.id, deletedAt: null },
        select: { id: true, version: true, validatedPlan: true, generatedAt: true },
      }),
      prisma.mealPlan.findFirst({
        where: { id: planBId, userId: user.id, deletedAt: null },
        select: { id: true, version: true, validatedPlan: true, generatedAt: true },
      }),
    ]);

    if (!planA) {
      return NextResponse.json({ error: 'Plan A not found' }, { status: 404 });
    }
    if (!planB) {
      return NextResponse.json({ error: 'Plan B not found' }, { status: 404 });
    }

    // Decompress validatedPlan (handles both compressed and legacy uncompressed data)
    const vpA = decompressJson<ValidatedPlan | null>(planA.validatedPlan);
    const vpB = decompressJson<ValidatedPlan | null>(planB.validatedPlan);

    const daysA = vpA?.days ?? [];
    const daysB = vpB?.days ?? [];

    // Build a map of days by dayNumber for each plan
    const dayMapA = new Map(daysA.map((d) => [d.dayNumber, d]));
    const dayMapB = new Map(daysB.map((d) => [d.dayNumber, d]));

    // Collect all day numbers from both plans
    const allDayNumbers = new Set([...dayMapA.keys(), ...dayMapB.keys()]);
    const sortedDays = [...allDayNumbers].sort((a, b) => a - b);

    const dayDiffs: DayDiff[] = sortedDays.map((dayNum) => {
      const dayA = dayMapA.get(dayNum);
      const dayB = dayMapB.get(dayNum);

      const targetKcalA = dayA?.targetKcal ?? 0;
      const targetKcalB = dayB?.targetKcal ?? 0;

      const mealsA = dayA?.meals ?? [];
      const mealsB = dayB?.meals ?? [];

      // Index meals by slot
      const slotMapA = new Map(mealsA.map((m) => [m.slot, m]));
      const slotMapB = new Map(mealsB.map((m) => [m.slot, m]));
      const allSlots = new Set([...slotMapA.keys(), ...slotMapB.keys()]);

      const mealChanges: MealChange[] = [...allSlots].map((slot) => {
        const mealA = slotMapA.get(slot);
        const mealB = slotMapB.get(slot);

        if (mealA && !mealB) {
          return {
            slot,
            type: 'removed',
            nameA: mealA.name,
            nutritionA: mealA.nutrition,
          };
        }

        if (!mealA && mealB) {
          return {
            slot,
            type: 'added',
            nameB: mealB.name,
            nutritionB: mealB.nutrition,
          };
        }

        // Both exist - check for changes
        const nameChanged = mealA!.name !== mealB!.name;
        const nutA = mealA!.nutrition;
        const nutB = mealB!.nutrition;

        // Check if any macro changed >5%
        const macroChanged = hasMacroChange(nutA, nutB, 0.05);

        if (nameChanged || macroChanged) {
          return {
            slot,
            type: 'changed',
            nameA: mealA!.name,
            nameB: mealB!.name,
            nutritionA: nutA,
            nutritionB: nutB,
          };
        }

        return {
          slot,
          type: 'unchanged',
          nameA: mealA!.name,
          nameB: mealB!.name,
          nutritionA: nutA,
          nutritionB: nutB,
        };
      });

      return {
        dayNumber: dayNum,
        dayName: dayA?.dayName ?? dayB?.dayName ?? `Day ${dayNum}`,
        kcalDiff: targetKcalB - targetKcalA,
        targetKcalA,
        targetKcalB,
        meals: mealChanges,
      };
    });

    return NextResponse.json({
      planA: { id: planA.id, version: planA.version, generatedAt: planA.generatedAt },
      planB: { id: planB.id, version: planB.version, generatedAt: planB.generatedAt },
      days: dayDiffs,
    });
  } catch (error) {
    logger.error('Error computing plan diff:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Returns true if any macro (kcal, protein, carbs, fat) differs by more than `threshold` (fraction). */
function hasMacroChange(a: MealNutrition, b: MealNutrition, threshold: number): boolean {
  const pairs: [number, number][] = [
    [a.kcal, b.kcal],
    [a.proteinG, b.proteinG],
    [a.carbsG, b.carbsG],
    [a.fatG, b.fatG],
  ];

  for (const [va, vb] of pairs) {
    const base = Math.max(va, vb, 1); // avoid division by zero
    if (Math.abs(va - vb) / base > threshold) return true;
  }

  return false;
}
