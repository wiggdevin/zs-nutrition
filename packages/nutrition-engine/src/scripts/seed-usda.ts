/* eslint-disable no-console */
/**
 * seed-usda.ts — Downloads USDA Foundation + SR Legacy bulk datasets and upserts
 * them into the UsdaFood table for sub-millisecond local lookups.
 *
 * Usage:
 *   npx tsx packages/nutrition-engine/src/scripts/seed-usda.ts
 *   npx tsx packages/nutrition-engine/src/scripts/seed-usda.ts --dry-run
 *
 * Requires DATABASE_URL to be set (reads from apps/web/.env automatically).
 */

import { PrismaClient } from '@prisma/client';
import AdmZip from 'adm-zip';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATASETS = [
  {
    name: 'Foundation',
    dataType: 'Foundation',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2025-12-18.zip',
    jsonFile: 'foundationDownload.json',
  },
  {
    name: 'SR Legacy',
    dataType: 'SR Legacy',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
    jsonFile: 'SRLegacyDownload.json',
  },
] as const;

// USDA nutrient number → key mapping
// 203=protein, 204=fat, 205=carbs, 208=calories, 291=fiber
const NUTRIENT_NUMBERS = ['203', '204', '205', '208', '291'];

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');
const CACHE_DIR = join(process.cwd(), '.usda-cache');

interface USDAFoodItem {
  fdcId: number;
  description: string;
  foodNutrients?: Array<{
    nutrient?: { number?: string | number };
    amount?: number;
  }>;
  foodPortions?: Array<{
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    measureUnit?: { name?: string };
    portionDescription?: string;
  }>;
}

function extractNutrients(foodNutrients: USDAFoodItem['foodNutrients']): Record<string, number> {
  const map: Record<string, number> = {};
  if (!foodNutrients) return map;

  for (const fn of foodNutrients) {
    const num = String(fn.nutrient?.number ?? '');
    if (NUTRIENT_NUMBERS.includes(num) && fn.amount !== null && fn.amount !== undefined) {
      map[num] = fn.amount;
    }
  }
  return map;
}

function extractPortions(
  foodPortions: USDAFoodItem['foodPortions']
): Array<{ gramWeight: number; description: string }> {
  if (!foodPortions) return [];

  return foodPortions
    .filter((p) => p.gramWeight && p.gramWeight > 0)
    .map((p) => ({
      gramWeight: p.gramWeight!,
      description: [
        p.amount ? String(p.amount) : '',
        p.measureUnit?.name || p.modifier || p.portionDescription || 'serving',
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
    }));
}

async function downloadDataset(dataset: (typeof DATASETS)[number]): Promise<USDAFoodItem[]> {
  const zipPath = join(CACHE_DIR, `${dataset.dataType.replace(/\s/g, '_')}.zip`);

  // Use cached ZIP if available
  if (!existsSync(zipPath)) {
    console.log(`  Downloading ${dataset.name} from ${dataset.url}...`);
    const response = await fetch(dataset.url);
    if (!response.ok) {
      throw new Error(
        `Failed to download ${dataset.name}: ${response.status} ${response.statusText}`
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(zipPath, buffer);
    console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log(`  Using cached ZIP for ${dataset.name}`);
  }

  console.log(`  Extracting ${dataset.jsonFile}...`);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Find the JSON file — may be nested in a subdirectory
  const jsonEntry = entries.find(
    (e) => e.entryName.endsWith(dataset.jsonFile) || e.entryName.endsWith('.json')
  );

  if (!jsonEntry) {
    // List what's actually in the ZIP for debugging
    const names = entries.map((e) => e.entryName).join(', ');
    throw new Error(`Could not find ${dataset.jsonFile} in ZIP. Contents: ${names}`);
  }

  console.log(
    `  Parsing ${jsonEntry.entryName} (${(jsonEntry.header.size / 1024 / 1024).toFixed(1)} MB)...`
  );
  const raw = jsonEntry.getData().toString('utf-8');
  const parsed = JSON.parse(raw);

  // The JSON structure varies: sometimes { FoundationFoods: [...] }, sometimes { SRLegacyFoods: [...] }
  const foods: USDAFoodItem[] =
    parsed.FoundationFoods ||
    parsed.SRLegacyFoods ||
    parsed.SurveyFoods ||
    (Array.isArray(parsed) ? parsed : []);

  console.log(`  Found ${foods.length} foods in ${dataset.name}`);
  return foods;
}

async function seedDataset(
  prisma: PrismaClient,
  dataset: (typeof DATASETS)[number],
  foods: USDAFoodItem[]
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < foods.length; i += BATCH_SIZE) {
    const batch = foods.slice(i, i + BATCH_SIZE);
    const records = batch.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      dataType: dataset.dataType,
      nutrients: extractNutrients(food.foodNutrients),
      portions: extractPortions(food.foodPortions),
    }));

    if (!DRY_RUN) {
      const result = await prisma.usdaFood.createMany({
        data: records,
        skipDuplicates: true,
      });
      inserted += result.count;
    } else {
      inserted += records.length;
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= foods.length) {
      console.log(
        `  [${dataset.dataType}] Processed ${Math.min(i + BATCH_SIZE, foods.length)}/${foods.length} (${inserted} inserted)`
      );
    }
  }

  return inserted;
}

async function main() {
  console.log(`\n=== USDA Food Database Seed${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const prisma = new PrismaClient();

  try {
    // Check existing count
    const existingCount = await prisma.usdaFood.count();
    console.log(`Existing UsdaFood rows: ${existingCount}\n`);

    const totals: Record<string, number> = {};

    for (const dataset of DATASETS) {
      console.log(`\n--- ${dataset.name} ---`);
      const foods = await downloadDataset(dataset);

      // Validate a sample
      const sample = foods[0];
      if (sample) {
        const nutrients = extractNutrients(sample.foodNutrients);
        console.log(`  Sample: "${sample.description}" (fdcId=${sample.fdcId})`);
        console.log(`  Nutrients: ${JSON.stringify(nutrients)}`);
        console.log(`  Portions: ${extractPortions(sample.foodPortions).length} entries`);
      }

      const inserted = await seedDataset(prisma, dataset, foods);
      totals[dataset.dataType] = inserted;
      console.log(`  ${dataset.name}: ${inserted} rows ${DRY_RUN ? 'would be' : ''} inserted`);
    }

    // Final summary
    const finalCount = DRY_RUN ? existingCount : await prisma.usdaFood.count();
    console.log(`\n=== Summary ===`);
    for (const [type, count] of Object.entries(totals)) {
      console.log(`  ${type}: ${count} rows`);
    }
    console.log(`  Total in DB: ${finalCount}`);
    console.log(`  Done!\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
