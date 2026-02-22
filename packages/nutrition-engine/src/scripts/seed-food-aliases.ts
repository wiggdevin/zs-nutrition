/**
 * Seed script: Populates the FoodAlias table from the original INGREDIENT_NAME_MAP.
 *
 * For each alias→canonicalName pair, attempts to resolve a direct fdcId by
 * running a tsvector search against UsdaFood. This enables O(1) lookups for
 * known ingredients (skip search entirely).
 *
 * Usage:
 *   npx tsx packages/nutrition-engine/src/scripts/seed-food-aliases.ts
 *
 * Requires DATABASE_URL environment variable.
 */

import { PrismaClient } from '@prisma/client';

// The original hardcoded map — migrating to FoodAlias table
const INGREDIENT_NAME_MAP: Record<string, string> = {
  // Proteins
  eggs: 'egg whole raw',
  egg: 'egg whole raw',
  'egg whites': 'egg white raw',
  chicken: 'chicken breast raw',
  'chicken breast': 'chicken breast skinless raw',
  salmon: 'atlantic salmon raw',
  tuna: 'tuna canned in water drained',
  shrimp: 'shrimp raw',
  'ground beef': 'ground beef 90 lean raw',
  'ground turkey': 'ground turkey raw',
  tofu: 'tofu firm raw',
  tempeh: 'tempeh',
  // Grains & starches
  rice: 'white rice cooked',
  'brown rice': 'brown rice cooked',
  'sweet potato': 'sweet potato baked',
  'sweet potatoes': 'sweet potato baked',
  potato: 'potato baked flesh and skin',
  potatoes: 'potato baked flesh and skin',
  oats: 'oats rolled dry',
  oatmeal: 'oats rolled dry',
  quinoa: 'quinoa cooked',
  pasta: 'pasta cooked',
  bread: 'whole wheat bread',
  // Vegetables
  broccoli: 'broccoli raw',
  spinach: 'spinach raw',
  kale: 'kale raw',
  'mixed greens': 'mixed salad greens raw',
  tomato: 'tomato raw',
  tomatoes: 'tomato raw',
  onion: 'onion raw',
  // Fruits
  banana: 'banana raw',
  apple: 'apple raw with skin',
  berries: 'mixed berries raw',
  blueberries: 'blueberries raw',
  strawberries: 'strawberries raw',
  avocado: 'avocado raw',
  // Dairy & fats
  'greek yogurt': 'greek yogurt plain nonfat',
  yogurt: 'yogurt plain low fat',
  cheese: 'cheddar cheese',
  butter: 'butter salted',
  'olive oil': 'olive oil',
  'coconut oil': 'coconut oil',
  milk: 'milk whole',
  // Nuts & seeds
  almonds: 'almonds raw',
  walnuts: 'walnuts raw',
  'peanut butter': 'peanut butter smooth',
  'almond butter': 'almond butter',
  // Legumes
  'black beans': 'black beans cooked',
  chickpeas: 'chickpeas cooked',
  lentils: 'lentils cooked',
  // Vegetables (expanded)
  asparagus: 'asparagus raw',
  cauliflower: 'cauliflower raw',
  'bell pepper': 'bell pepper raw',
  'bell peppers': 'bell pepper raw',
  'red bell pepper': 'bell pepper red raw',
  'green bell pepper': 'bell pepper green raw',
  zucchini: 'zucchini raw',
  mushrooms: 'mushrooms raw white',
  mushroom: 'mushrooms raw white',
  cucumber: 'cucumber raw',
  celery: 'celery raw',
  'green beans': 'green beans raw',
  cabbage: 'cabbage raw',
  eggplant: 'eggplant raw',
  carrots: 'carrots raw',
  carrot: 'carrots raw',
  // Proteins (expanded)
  cod: 'cod atlantic raw',
  'cod fillet': 'cod atlantic raw',
  'pork tenderloin': 'pork tenderloin raw',
  'pork chop': 'pork chop boneless raw',
  'turkey breast': 'turkey breast skinless raw',
  tilapia: 'tilapia raw',
  'mahi mahi': 'mahi mahi raw',
  scallops: 'scallops raw',
  // Condiments & sauces
  'soy sauce': 'soy sauce',
  'fish sauce': 'fish sauce',
  sriracha: 'sriracha hot chili sauce',
  breadcrumbs: 'bread crumbs plain dry',
  mirin: 'rice wine mirin',
  tahini: 'tahini sesame paste',
  // Dairy (expanded)
  'cottage cheese': 'cottage cheese low fat 2%',
  'cream cheese': 'cream cheese',
  parmesan: 'parmesan cheese grated',
  mozzarella: 'mozzarella cheese',
  feta: 'feta cheese crumbled',
  ricotta: 'ricotta cheese part skim',
  // Nuts & seeds (expanded)
  'chia seeds': 'chia seeds dried',
  'flax seeds': 'flax seeds ground',
  flaxseed: 'flax seeds ground',
  'hemp seeds': 'hemp seeds hulled',
  'pumpkin seeds': 'pumpkin seeds raw',
  'sunflower seeds': 'sunflower seed kernels',
  cashews: 'cashews raw',
  pecans: 'pecans raw',
  'pine nuts': 'pine nuts dried',
  // Grains (expanded)
  couscous: 'couscous cooked',
  farro: 'farro cooked',
  bulgur: 'bulgur cooked',
  // Cooked variants — prevent dry-value lookups
  'quinoa cooked': 'quinoa cooked',
  'cooked quinoa': 'quinoa cooked',
  'rice cooked': 'white rice cooked',
  'cooked rice': 'white rice cooked',
  'pasta cooked': 'pasta cooked',
  'cooked pasta': 'pasta cooked',
  'lentils cooked': 'lentils cooked',
  'cooked lentils': 'lentils cooked',
  tortilla: 'flour tortilla',
  naan: 'naan bread',
  'jasmine rice': 'jasmine rice cooked',
  'basmati rice': 'basmati rice cooked',
};

async function main() {
  const prisma = new PrismaClient();

  try {
    console.warn(`Seeding ${Object.keys(INGREDIENT_NAME_MAP).length} food aliases...`);

    let resolved = 0;
    let unresolved = 0;

    for (const [alias, canonicalName] of Object.entries(INGREDIENT_NAME_MAP)) {
      // Try to resolve fdcId via tsvector search
      const rows = await prisma.$queryRawUnsafe<{ fdcId: number }[]>(
        `SELECT "fdcId" FROM "UsdaFood"
         WHERE "searchVector" @@ plainto_tsquery('english', $1)
         ORDER BY ts_rank("searchVector", plainto_tsquery('english', $1)) DESC
         LIMIT 1`,
        canonicalName
      );

      const fdcId = rows.length > 0 ? rows[0].fdcId : null;

      await prisma.foodAlias.upsert({
        where: { alias },
        create: {
          alias,
          canonicalName,
          usdaFdcId: fdcId,
          priority: 0,
        },
        update: {
          canonicalName,
          usdaFdcId: fdcId,
        },
      });

      if (fdcId) {
        resolved++;
      } else {
        unresolved++;
        console.warn(`  [MISS] "${alias}" → "${canonicalName}" (no fdcId found)`);
      }
    }

    console.warn(`\nDone! ${resolved} resolved with fdcId, ${unresolved} without.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
