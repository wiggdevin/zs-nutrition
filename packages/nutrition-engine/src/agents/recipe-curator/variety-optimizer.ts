import type { MealCandidate } from '../../data/meal-database';

const EXEMPT_PROTEINS = [
  'mixed',
  'dairy',
  'eggs',
  'whey',
  'tofu',
  'beans',
  'chickpeas',
  'lentils',
  'soy',
];

/**
 * Check if a protein is exempt from the consecutive-day variety rule.
 * Exempt proteins (e.g. dairy, eggs, plant-based) can repeat on consecutive days.
 */
export function isProteinExempt(protein: string): boolean {
  const proteinLower = protein.toLowerCase();
  return EXEMPT_PROTEINS.some(
    (e) => proteinLower === e || proteinLower.includes(e) || e.includes(proteinLower)
  );
}

/**
 * Check if a protein (or a related protein) was used on the previous day using fuzzy matching.
 */
export function wasProteinUsedYesterday(protein: string, previousDayProteins: string[]): boolean {
  const proteinLower = protein.toLowerCase();
  return previousDayProteins.some(
    (prevProtein) =>
      prevProtein === proteinLower ||
      prevProtein.includes(proteinLower) ||
      proteinLower.includes(prevProtein)
  );
}

/**
 * Select a meal from the available pools while respecting variety rules:
 * - No repeated meals within a recent window
 * - No repeated primary protein on consecutive days (except exempt proteins)
 * - Prioritize preferred cuisines ~75% of the time
 *
 * @param randomFn - Random number generator (0-1). Defaults to Math.random.
 *   Pass a seeded PRNG for deterministic, reproducible results.
 *
 * Returns the selected MealCandidate or null if nothing is found.
 */
export function selectMealWithVariety(
  slotData: { preferred: MealCandidate[]; other: MealCandidate[] },
  recentMealNames: string[],
  previousDayProteins: string[],
  mealsPerDay: number,
  randomFn: () => number = Math.random
): MealCandidate | null {
  // Strategy: Try preferred cuisines 75% of the time
  const usePreferred = slotData.preferred.length > 0 && randomFn() < 0.75;

  let selected: MealCandidate | null = null;

  if (usePreferred) {
    selected = pickFromPool(
      slotData.preferred,
      recentMealNames,
      previousDayProteins,
      mealsPerDay * 2 // preferred: 1 day window (narrower)
    );
  }

  // If no suitable preferred meal (or we're using other pool), try other cuisines
  if (!selected && slotData.other.length > 0) {
    selected = pickFromPool(
      slotData.other,
      recentMealNames,
      previousDayProteins,
      mealsPerDay * 4 // other: 3 day window (wider)
    );
  }

  // Ultimate fallback: pick first available that doesn't violate consecutive protein rule
  if (!selected) {
    selected = fallbackSelect(slotData, previousDayProteins);
  }

  return selected;
}

/**
 * Pick a meal from a pool checking recent meal names and consecutive protein rules.
 */
function pickFromPool(
  pool: MealCandidate[],
  recentMealNames: string[],
  previousDayProteins: string[],
  recentWindow: number
): MealCandidate | null {
  const recentSlice = recentMealNames.slice(-recentWindow);

  for (const candidate of pool) {
    if (recentSlice.includes(candidate.name)) {
      continue;
    }

    const exempt = isProteinExempt(candidate.primaryProtein);
    const usedYesterday = wasProteinUsedYesterday(candidate.primaryProtein, previousDayProteins);

    if (usedYesterday && !exempt) {
      continue;
    }

    return candidate;
  }

  return null;
}

/**
 * Fallback selection: try any meal that doesn't violate consecutive protein rule.
 * As an absolute last resort, pick the first available meal even if it violates.
 */
function fallbackSelect(
  slotData: { preferred: MealCandidate[]; other: MealCandidate[] },
  previousDayProteins: string[]
): MealCandidate | null {
  // Try preferred pool first
  for (const candidate of slotData.preferred) {
    const exempt = isProteinExempt(candidate.primaryProtein);
    const usedYesterday = wasProteinUsedYesterday(candidate.primaryProtein, previousDayProteins);
    if (!usedYesterday || exempt) {
      return candidate;
    }
  }

  // Try other pool
  for (const candidate of slotData.other) {
    const exempt = isProteinExempt(candidate.primaryProtein);
    const usedYesterday = wasProteinUsedYesterday(candidate.primaryProtein, previousDayProteins);
    if (!usedYesterday || exempt) {
      return candidate;
    }
  }

  // Absolute last resort: pick first available even if it violates the rule
  return slotData.preferred[0] || slotData.other[0] || null;
}

/**
 * Rotate a selected meal to the end of its pool to ensure variety across iterations.
 */
export function rotateMealInPool(
  selected: MealCandidate,
  slotData: { preferred: MealCandidate[]; other: MealCandidate[] }
): void {
  const pool = slotData.preferred.includes(selected) ? slotData.preferred : slotData.other;
  const idx = pool.indexOf(selected);
  if (idx >= 0) {
    pool.push(pool.splice(idx, 1)[0]);
  }
}
