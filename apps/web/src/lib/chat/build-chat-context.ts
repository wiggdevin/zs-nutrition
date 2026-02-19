import { prisma } from '@/lib/prisma';
import { toLocalDay } from '@/lib/date-utils';

export interface ChatContext {
  systemPrompt: string;
  hasProfile: boolean;
  hasActivePlan: boolean;
}

export async function buildChatContext(dbUserId: string): Promise<ChatContext> {
  const today = toLocalDay();

  const [profile, mealPlan, dailyLog, weightEntries] = await Promise.all([
    prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
      select: {
        name: true,
        sex: true,
        age: true,
        heightCm: true,
        weightKg: true,
        goalType: true,
        goalRate: true,
        activityLevel: true,
        dietaryStyle: true,
        allergies: true,
        exclusions: true,
        mealsPerDay: true,
        snacksPerDay: true,
        goalKcal: true,
        proteinTargetG: true,
        carbsTargetG: true,
        fatTargetG: true,
      },
    }),
    prisma.mealPlan.findFirst({
      where: { userId: dbUserId, isActive: true, status: 'active' },
      orderBy: { generatedAt: 'desc' },
      select: {
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        planDays: true,
        qaScore: true,
        qaStatus: true,
      },
    }),
    prisma.dailyLog.findUnique({
      where: { userId_date: { userId: dbUserId, date: today } },
      select: {
        targetKcal: true,
        targetProteinG: true,
        targetCarbsG: true,
        targetFatG: true,
        actualKcal: true,
        actualProteinG: true,
        actualCarbsG: true,
        actualFatG: true,
        adherenceScore: true,
      },
    }),
    prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'desc' },
      take: 4,
      select: { weightKg: true, weightLbs: true, logDate: true },
    }),
  ]);

  const sections: string[] = [];

  // Role definition
  sections.push(`You are /// Coach, a concise evidence-based nutrition coach for Zero Sum Nutrition.

Rules:
- Only answer nutrition, diet, meal planning, weight management, and fitness-related questions.
- If asked about non-nutrition topics, politely decline and redirect to nutrition.
- Be concise — aim for 2-4 sentences unless the user asks for detail.
- Reference the user's actual data when relevant (goals, macros, progress).
- Use markdown formatting for lists and emphasis.
- Never invent data the user hasn't provided.`);

  // User profile
  if (profile) {
    const allergies = Array.isArray(profile.allergies)
      ? (profile.allergies as string[]).join(', ')
      : 'none';
    const exclusions = Array.isArray(profile.exclusions)
      ? (profile.exclusions as string[]).join(', ')
      : 'none';
    sections.push(`USER PROFILE:
- Name: ${profile.name}, ${profile.sex}, age ${profile.age}
- Height: ${profile.heightCm}cm, Weight: ${profile.weightKg}kg
- Goal: ${profile.goalType} at ${profile.goalRate} lbs/week
- Activity: ${profile.activityLevel}, Diet: ${profile.dietaryStyle}
- Meals/day: ${profile.mealsPerDay}, Snacks: ${profile.snacksPerDay}
- Allergies: ${allergies}
- Exclusions: ${exclusions}
- Macro targets: ${profile.goalKcal ?? '?'}kcal, ${profile.proteinTargetG ?? '?'}g protein, ${profile.carbsTargetG ?? '?'}g carbs, ${profile.fatTargetG ?? '?'}g fat`);
  }

  // Active meal plan
  if (mealPlan) {
    sections.push(`ACTIVE MEAL PLAN:
- Daily targets: ${mealPlan.dailyKcalTarget}kcal, ${mealPlan.dailyProteinG}g P / ${mealPlan.dailyCarbsG}g C / ${mealPlan.dailyFatG}g F
- Duration: ${mealPlan.planDays} days
- QA: ${mealPlan.qaStatus ?? 'N/A'} (score ${mealPlan.qaScore ?? 'N/A'})`);
  }

  // Today's progress
  if (dailyLog) {
    const pctKcal = dailyLog.targetKcal
      ? Math.round((dailyLog.actualKcal / dailyLog.targetKcal) * 100)
      : null;
    sections.push(`TODAY'S PROGRESS:
- Consumed: ${dailyLog.actualKcal}kcal, ${dailyLog.actualProteinG}g P / ${dailyLog.actualCarbsG}g C / ${dailyLog.actualFatG}g F
- Targets: ${dailyLog.targetKcal ?? '?'}kcal, ${dailyLog.targetProteinG ?? '?'}g P / ${dailyLog.targetCarbsG ?? '?'}g C / ${dailyLog.targetFatG ?? '?'}g F
- Progress: ${pctKcal !== null ? `${pctKcal}% of calorie target` : 'no target set'}
- Adherence: ${dailyLog.adherenceScore ?? 'not scored yet'}`);
  }

  // Recent weight
  if (weightEntries.length > 0) {
    const entries = weightEntries
      .map((w) => `${w.logDate.toISOString().split('T')[0]}: ${w.weightLbs.toFixed(1)} lbs`)
      .join(', ');
    const latest = weightEntries[0];
    const oldest = weightEntries[weightEntries.length - 1];
    const change = latest.weightLbs - oldest.weightLbs;
    sections.push(`RECENT WEIGHT (last ${weightEntries.length} entries):
- ${entries}
- Trend: ${change > 0 ? '+' : ''}${change.toFixed(1)} lbs`);
  }

  return {
    systemPrompt: sections.join('\n\n'),
    hasProfile: !!profile,
    hasActivePlan: !!mealPlan,
  };
}
