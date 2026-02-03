/**
 * Feature #496: Grocery list amounts are practical
 * Test that ingredient quantities are rounded to practical shopping amounts
 */

import { QAValidator } from '../../packages/nutrition-engine/src/agents/qa-validator';

// Test the roundUpForShopping method directly
const testCases = [
  // Grams - should round up to nearest 10g for amounts <= 100g
  { input: 23, unit: 'g', expected: 30, description: '23g → 30g (nearest 10g)' },
  { input: 67, unit: 'g', expected: 70, description: '67g → 70g (nearest 10g)' },
  { input: 101, unit: 'g', expected: 125, description: '101g → 125g (nearest 25g)' },
  { input: 273, unit: 'g', expected: 275, description: '273g → 275g (nearest 25g)' },
  { input: 523, unit: 'g', expected: 550, description: '523g → 550g (nearest 50g)' },

  // Milliliters - should round up to nearest 25ml or 50ml
  { input: 137, unit: 'ml', expected: 150, description: '137ml → 150ml (nearest 25ml)' },
  { input: 267, unit: 'ml', expected: 300, description: '267ml → 300ml (nearest 50ml)' },

  // Cups - should round up to nearest 0.25 cup (3/4 cup is practical!)
  { input: 0.73, unit: 'cup', expected: 0.75, description: '0.73 cup → 0.75 cup (3/4 cup is practical)' },
  { input: 1.26, unit: 'cups', expected: 1.5, description: '1.26 cups → 1.5 cups (nearest 0.25)' },

  // Tablespoons - should round up to whole tbsp
  { input: 1.3, unit: 'tbsp', expected: 2, description: '1.3 tbsp → 2 tbsp (whole number)' },
  { input: 2.7, unit: 'tablespoons', expected: 3, description: '2.7 tbsp → 3 tbsp (whole number)' },

  // Teaspoons - should round up to nearest 0.5 tsp
  { input: 0.3, unit: 'tsp', expected: 0.5, description: '0.3 tsp → 0.5 tsp (nearest 0.5)' },
  { input: 1.6, unit: 'teaspoons', expected: 2, description: '1.6 tsp → 2 tsp (nearest 0.5)' },

  // Pounds - should round up to nearest 0.5 lb
  { input: 1.1, unit: 'lb', expected: 1.5, description: '1.1 lb → 1.5 lb (nearest 0.5)' },
  { input: 2.3, unit: 'lbs', expected: 2.5, description: '2.3 lbs → 2.5 lbs (nearest 0.5)' },

  // Ounces - should round up to whole ounces
  { input: 3.2, unit: 'oz', expected: 4, description: '3.2 oz → 4 oz (whole number)' },
  { input: 7.8, unit: 'ounces', expected: 8, description: '7.8 oz → 8 oz (whole number)' },

  // Pieces/slices - should round up to whole numbers
  { input: 5.3, unit: 'pieces', expected: 6, description: '5.3 pieces → 6 pieces (whole)' },
  { input: 3.1, unit: 'slices', expected: 4, description: '3.1 slices → 4 slices (whole)' },
];

console.log('=== Feature #496: Grocery List Rounding Tests ===\n');

// Access the private method via prototype
const validator = new QAValidator();
const roundMethod = (validator as any).roundUpForShopping.bind(validator);

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = roundMethod(test.input, test.unit);
  const success = Math.abs(result - test.expected) < 0.01;

  if (success) {
    console.log(`✓ PASS: ${test.description}`);
    passed++;
  } else {
    console.log(`✗ FAIL: ${test.description}`);
    console.log(`  Expected: ${test.expected}, Got: ${result}`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed}/${testCases.length} passed ===`);

if (failed === 0) {
  console.log('\n✓ All rounding tests PASSED!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failed} test(s) FAILED`);
  process.exit(1);
}
