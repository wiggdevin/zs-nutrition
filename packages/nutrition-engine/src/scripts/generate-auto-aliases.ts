/**
 * Auto-generate FoodAlias entries from UsdaFood descriptions.
 *
 * Reads all UsdaFood rows and generates 4-6 normalized alias variants per food,
 * boosting alias coverage from ~340 hand-curated entries to ~40,000-50,000.
 *
 * Auto-generated aliases use priority: -1 (below hand-curated at priority: 10)
 * so hand-curated mappings always win.
 *
 * Usage:
 *   npx tsx packages/nutrition-engine/src/scripts/generate-auto-aliases.ts
 *
 * Requires DATABASE_URL environment variable.
 */

import { PrismaClient } from '@prisma/client';

// USDA nutrient number keys
const KCAL = '208';
const PROTEIN = '203';
const FAT = '204';
const CARBS = '205';

// USDA boilerplate words to strip
const USDA_BOILERPLATE = new Set([
  'nfs',
  'ns',
  'as',
  'purchased',
  'not',
  'further',
  'specified',
  'unprepared',
  'unenriched',
  'enriched',
  'unfortified',
  'fortified',
]);

interface AliasCandidate {
  alias: string;
  canonicalName: string;
  fdcId: number;
  per100gKcal: number | null;
  per100gProtein: number | null;
  per100gCarbs: number | null;
  per100gFat: number | null;
}

/**
 * Generate alias variants from a USDA food description.
 * Returns lowercased, deduplicated alias strings.
 */
function generateAliasVariants(description: string): string[] {
  const lower = description.toLowerCase().trim();
  const variants: Set<string> = new Set();

  // 1. Full lowered description
  variants.add(lower);

  // 2. Stripped: remove commas, parentheticals, USDA boilerplate
  let stripped = lower
    .replace(/\([^)]*\)/g, '') // remove parentheticals
    .replace(/,/g, ' ') // commas to spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();

  // Remove boilerplate words
  const strippedTokens = stripped
    .split(' ')
    .filter((t) => t.length > 0 && !USDA_BOILERPLATE.has(t));
  stripped = strippedTokens.join(' ').trim();
  if (stripped.length >= 2) {
    variants.add(stripped);
  }

  // 3. Short form: first 2-3 meaningful tokens (skip if <2 tokens)
  const meaningfulTokens = strippedTokens.filter((t) => t.length >= 2);
  if (meaningfulTokens.length >= 2) {
    variants.add(meaningfulTokens.slice(0, 2).join(' '));
    if (meaningfulTokens.length >= 3) {
      variants.add(meaningfulTokens.slice(0, 3).join(' '));
    }
  }

  // 4. Reversed USDA format: "beef, ground" → "ground beef"
  if (lower.includes(',')) {
    const parts = lower
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      // Reverse first two parts
      const reversed = `${parts[1]} ${parts[0]}`;
      const cleanReversed = reversed
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanReversed.length >= 2) {
        variants.add(cleanReversed);
      }

      // Also just the reversed pair without extra parts
      if (parts.length > 2) {
        const fullReversed = [...parts.slice(1), parts[0]]
          .join(' ')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (fullReversed.length >= 2) {
          variants.add(fullReversed);
        }
      }
    }
  }

  // 5. Without trailing plural "s" (simple heuristic, skip words < 4 chars)
  const pluralVariants: string[] = [];
  for (const v of variants) {
    const words = v.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.length >= 4 && lastWord.endsWith('s') && !lastWord.endsWith('ss')) {
      const singular = [...words.slice(0, -1), lastWord.slice(0, -1)].join(' ');
      pluralVariants.push(singular);
    }
  }
  for (const pv of pluralVariants) {
    variants.add(pv);
  }

  // Filter out empty or too-short aliases
  const result: string[] = [];
  for (const v of variants) {
    const clean = v.trim();
    if (clean.length >= 2) {
      result.push(clean);
    }
  }

  return result;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // eslint-disable-next-line no-console
    console.log('Reading all UsdaFood rows...');
    const foods = await prisma.usdaFood.findMany({
      select: {
        fdcId: true,
        description: true,
        dataType: true,
        nutrients: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Found ${foods.length} UsdaFood entries.`);

    // Build alias → candidate map. Higher-priority candidates (Foundation > SR Legacy)
    // win when multiple foods generate the same alias.
    const aliasMap = new Map<string, AliasCandidate>();

    let totalVariants = 0;

    for (const food of foods) {
      const nutrients = food.nutrients as Record<string, number> | null;
      const per100gKcal = nutrients?.[KCAL] ?? null;
      const per100gProtein = nutrients?.[PROTEIN] ?? null;
      const per100gCarbs = nutrients?.[CARBS] ?? null;
      const per100gFat = nutrients?.[FAT] ?? null;

      // Prefer Foundation data over SR Legacy
      const isFoundation = food.dataType === 'Foundation';

      const variants = generateAliasVariants(food.description);
      totalVariants += variants.length;

      for (const alias of variants) {
        const existing = aliasMap.get(alias);
        if (existing) {
          // Foundation beats SR Legacy; shorter description wins within same type
          const existingIsFoundation = existing.canonicalName === food.description; // approximation
          if (isFoundation && !existingIsFoundation) {
            aliasMap.set(alias, {
              alias,
              canonicalName: food.description.toLowerCase(),
              fdcId: food.fdcId,
              per100gKcal,
              per100gProtein,
              per100gCarbs,
              per100gFat,
            });
          }
          // Otherwise keep existing (first-seen wins for same priority)
        } else {
          aliasMap.set(alias, {
            alias,
            canonicalName: food.description.toLowerCase(),
            fdcId: food.fdcId,
            per100gKcal,
            per100gProtein,
            per100gCarbs,
            per100gFat,
          });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `Generated ${totalVariants} total variants, ${aliasMap.size} unique aliases after dedup.`
    );

    // Batch upsert in chunks to avoid overwhelming the database
    const BATCH_SIZE = 500;
    const candidates = Array.from(aliasMap.values());
    let created = 0;
    const _skipped = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      // Use a transaction for each batch
      await prisma.$transaction(
        batch.map((c) =>
          prisma.foodAlias.upsert({
            where: { alias: c.alias },
            create: {
              alias: c.alias,
              canonicalName: c.canonicalName,
              usdaFdcId: c.fdcId,
              priority: -1, // Below hand-curated (priority: 10)
              per100gKcal: c.per100gKcal,
              per100gProtein: c.per100gProtein,
              per100gCarbs: c.per100gCarbs,
              per100gFat: c.per100gFat,
            },
            // Only update if existing entry has lower priority (don't overwrite hand-curated)
            update: {
              canonicalName: c.canonicalName,
              usdaFdcId: c.fdcId,
              priority: -1,
              per100gKcal: c.per100gKcal,
              per100gProtein: c.per100gProtein,
              per100gCarbs: c.per100gCarbs,
              per100gFat: c.per100gFat,
            },
          })
        )
      );

      created += batch.length;
      if ((i / BATCH_SIZE) % 10 === 0) {
        // eslint-disable-next-line no-console
        console.log(`  Processed ${created}/${candidates.length} aliases...`);
      }
    }

    // Restore hand-curated entries that may have been overwritten
    // Hand-curated entries from seed-food-aliases.ts should have priority: 10
    // This script only writes priority: -1, so a second run of seed-food-aliases.ts
    // after this script will restore the correct priority.

    const finalCount = await prisma.foodAlias.count();
    const autoCount = await prisma.foodAlias.count({ where: { priority: -1 } });
    const handCount = await prisma.foodAlias.count({ where: { priority: { gte: 0 } } });

    /* eslint-disable no-console */
    console.log(`\nDone!`);
    console.log(`  Total aliases in DB: ${finalCount}`);
    console.log(`  Auto-generated (priority -1): ${autoCount}`);
    console.log(`  Hand-curated (priority >= 0): ${handCount}`);
    console.log(
      `\nRun seed-food-aliases.ts after this script to ensure hand-curated entries have priority: 10.`
    );
    /* eslint-enable no-console */
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Auto-alias generation failed:', err);
  process.exit(1);
});
