/**
 * Debug: inspect what FatSecret returns for "quinoa cooked" searches
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { FatSecretAdapter } = require('./dist/index.js');
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(import.meta.dirname, '..', '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const fs = new FatSecretAdapter({
  clientId: process.env.FATSECRET_CLIENT_ID,
  clientSecret: process.env.FATSECRET_CLIENT_SECRET,
});

async function main() {
  console.log('=== Search: "quinoa cooked" ===\n');
  const results = await fs.searchFoods('quinoa cooked', 8);
  for (const r of results) {
    console.log(`  [${r.foodId}] "${r.name}" ${r.brandName ? `(brand: ${r.brandName})` : '(generic)'}`);
    console.log(`    desc: ${r.description}`);
  }

  // Get details for top 3 generic results
  const generics = results.filter(r => !r.brandName).slice(0, 3);
  for (const r of generics) {
    console.log(`\n--- Food Details: "${r.name}" (${r.foodId}) ---`);
    const details = await fs.getFood(r.foodId);
    console.log(`  Full name: "${details.name}"`);
    console.log(`  Servings (${details.servings.length}):`);
    for (const s of details.servings) {
      const grams = s.metricServingAmount;
      const unit = s.metricServingUnit;
      const kcalPerG = grams && grams > 0 ? (s.calories / grams).toFixed(2) : 'N/A';
      const carbsPerG = grams && grams > 0 ? (s.carbohydrate / grams).toFixed(2) : 'N/A';
      console.log(`    "${s.servingDescription}" | ${grams}${unit} | ${s.calories} kcal | P:${s.protein}g C:${s.carbohydrate}g F:${s.fat}g Fiber:${s.fiber}g`);
      console.log(`      kcal/g: ${kcalPerG} | carbs/g: ${carbsPerG}`);
    }
  }
}

main().catch(console.error);
