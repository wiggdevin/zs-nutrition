import type { GroceryItem, GroceryCategory } from './types';

/**
 * Normalize a raw grocery item (from various pipeline formats) into standard GroceryItem.
 * Handles cases where items may be strings, have 'amount' as string (e.g., "700g"), or be
 * in the proper {name, amount, unit} format.
 */
export function normalizeGroceryItem(raw: Record<string, unknown>): GroceryItem {
  const name =
    (raw.name as string) || (raw.food_name as string) || (raw.item as string) || 'Unknown Item';
  let amount: number;
  let unit: string;

  if (typeof raw.amount === 'number' && typeof raw.unit === 'string') {
    // Standard format: { name, amount: number, unit: string }
    amount = raw.amount;
    unit = raw.unit;
  } else if (typeof raw.amount === 'string') {
    // Legacy format: { name, amount: "700g" } — parse number and unit from string
    const match = (raw.amount as string).match(/^([\d.]+)\s*(.*)$/);
    if (match) {
      amount = parseFloat(match[1]);
      unit = match[2] || (raw.unit as string) || '';
    } else {
      amount = 0;
      unit = raw.amount as string;
    }
  } else if (typeof raw.quantity === 'number') {
    // Alternative format: { name, quantity, unit }
    amount = raw.quantity as number;
    unit = (raw.unit as string) || '';
  } else {
    amount = 0;
    unit = '';
  }

  return { name, amount, unit };
}

/**
 * Normalize a raw grocery list from any pipeline format into standard GroceryCategory[].
 * Handles multiple formats:
 * 1. Standard: { category, items: [{ name, amount, unit }] }
 * 2. String items: { category, items: ["Chicken breast", "Rice"] }
 * 3. Legacy amounts: { category, items: [{ name, amount: "700g" }] }
 */
export function normalizeGroceryList(raw: unknown[]): GroceryCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .filter((cat): cat is Record<string, unknown> => cat !== null && typeof cat === 'object')
    .map((cat) => {
      const items = Array.isArray(cat.items)
        ? (cat.items as unknown[]).map((item) => {
            // Case 1: item is a string (e.g., "Chicken breast")
            if (typeof item === 'string') {
              return { name: item, amount: 0, unit: '' };
            }
            // Case 2: item is an object
            if (item !== null && typeof item === 'object') {
              return normalizeGroceryItem(item as Record<string, unknown>);
            }
            return { name: String(item), amount: 0, unit: '' };
          })
        : [];
      return {
        category: (cat.category as string) || 'Other',
        items,
      };
    })
    .filter((cat) => cat.items.length > 0);
}

/**
 * Format a grocery amount for practical display.
 * Rounds UP to the nearest practical amount (e.g., "2 lbs" not "1.73 lbs").
 * This ensures shoppers buy enough rather than too little.
 */
export function formatGroceryAmount(amount: number, unit: string): string {
  if (!amount && !unit) return 'as needed';
  if (!amount || isNaN(amount)) return unit || 'as needed';

  const unitStr = unit || '';

  // For display, format whole numbers without decimals
  if (Number.isInteger(amount)) {
    return `${amount} ${unitStr}`.trim();
  }

  // For quarter increments, show as fraction-like
  const quarters = amount * 4;
  if (Number.isInteger(Math.round(quarters))) {
    const frac = amount % 1;
    const whole = Math.floor(amount);
    if (Math.abs(frac - 0.25) < 0.01) return `${whole > 0 ? whole + ' ' : ''}1/4 ${unitStr}`.trim();
    if (Math.abs(frac - 0.5) < 0.01) return `${whole > 0 ? whole + ' ' : ''}1/2 ${unitStr}`.trim();
    if (Math.abs(frac - 0.75) < 0.01) return `${whole > 0 ? whole + ' ' : ''}3/4 ${unitStr}`.trim();
  }

  // Round UP to nearest whole number for practical shopping
  // e.g., 1.73 lbs -> 2 lbs, 0.52 lbs -> 1 lb
  const roundedUp = Math.ceil(amount);
  return `${roundedUp} ${unitStr}`.trim();
}

/** Format prep/cook time for display. Returns null if both are 0/undefined. */
export function formatPrepTime(
  prepTimeMin?: number,
  cookTimeMin?: number
): { total: string; breakdown: string | null } | null {
  const prep = prepTimeMin || 0;
  const cook = cookTimeMin || 0;
  const total = prep + cook;
  if (total === 0) return null;

  let breakdown: string | null = null;
  if (prep > 0 && cook > 0) {
    breakdown = `${prep}m prep + ${cook}m cook`;
  }

  return { total: `${total} min`, breakdown };
}

/** Format prep/cook time as a compact string for cards. */
export function formatPrepTimeCompact(prepTimeMin?: number, cookTimeMin?: number): string {
  const prep = prepTimeMin || 0;
  const cook = cookTimeMin || 0;
  if (prep > 0 && cook > 0) return `${prep}m prep + ${cook}m cook`;
  if (prep > 0) return `${prep}m prep`;
  if (cook > 0) return `${cook}m cook`;
  return 'Time N/A';
}

/** Format a raw slot name (e.g. "SNACK_1", "EVENING_SNACK") for display */
export function formatSlotName(slot: string): string {
  return slot
    .replace(/_\d+$/, '') // "SNACK_1" -> "SNACK"
    .replace(/_/g, ' ') // "EVENING_SNACK" -> "EVENING SNACK"
    .replace(/\b(\w)(\w*)/g, (_, f, r) => f.toUpperCase() + r.toLowerCase());
}

/**
 * Detect generic placeholder instructions that provide no real recipe value.
 * Returns true if the instructions are templated filler (e.g. "Prepare ingredients, combine, serve").
 * Used to hide useless instructions in the meal detail modal (Issue #09).
 */
export function isGenericInstruction(instructions: string[]): boolean {
  if (!instructions || instructions.length === 0) return true;

  const combined = instructions.join(' ').toLowerCase();
  const totalWords = combined.split(/\s+/).length;

  // If there are 4+ steps or 25+ words, treat as real instructions
  if (instructions.length >= 4 || totalWords >= 25) return false;

  // Known generic template patterns
  const GENERIC_PATTERNS = [
    /prepare all ingredients[:.]?\s*(wash|measure|portion)/i,
    /combine ingredients in a (bowl|container)/i,
    /mix well and serve/i,
    /prepare all ingredients[\s\S]*combine[\s\S]*serve/i,
    /^prepare[.\s]*combine[.\s]*serve\.?$/i,
    /wash[,\s]+measure[,\s]+and portion/i,
    /season to taste and serve/i,
    /plate and enjoy/i,
  ];

  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(combined)) return true;
  }

  // Heuristic: 3 or fewer very short steps with low word count is likely a template
  if (instructions.length <= 3 && totalWords < 20) return true;

  return false;
}

/** Calculate macro calorie percentages for proportional display */
export function calculateMacroPercentages(
  proteinG: number,
  carbsG: number,
  fatG: number
): { protein: number; carbs: number; fat: number } {
  const proteinCal = proteinG * 4;
  const carbsCal = carbsG * 4;
  const fatCal = fatG * 9;
  const total = proteinCal + carbsCal + fatCal;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round((proteinCal / total) * 100);
  const carbs = Math.round((carbsCal / total) * 100);
  const fat = 100 - protein - carbs; // ensure they sum to 100
  return { protein, carbs, fat };
}

/**
 * Clean raw FatSecret ingredient names for user-friendly display.
 * Strips all-caps brand prefixes, converts to title case, removes
 * redundant descriptors, and cleans database-style formatting artifacts.
 */
export function cleanIngredientName(rawName: string): string {
  if (!rawName || rawName.trim().length === 0) return 'Unknown ingredient';

  let name = rawName.trim();

  // Step 1: Remove parenthetical portion/serving info first (before comma-based brand detection)
  // Handles "(1 slice, 28g)", "(per 100g)" — prevents internal commas from confusing brand logic
  name = name.replace(/\s*\(\s*(?:\d|per\s)\s*[^)]*\)\s*/gi, ' ').trim();

  // Step 2: Remove brand-name prefix — "BRAND'S, Product", "HOT POCKETS, ..."
  // Split on first comma and check if prefix is brand-like (predominantly uppercase)
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0 && commaIdx < name.length - 1) {
    const prefix = name.slice(0, commaIdx).trim();
    const rest = name.slice(commaIdx + 1).trim();
    const upperCount = (prefix.match(/[A-Z]/g) || []).length;
    const letterCount = (prefix.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 1 && upperCount / letterCount > 0.6 && rest.length > 0) {
      name = rest;
    }
  }

  // Step 3: Remove redundant descriptors that add noise
  const redundant = ['skinless', 'boneless', 'raw', 'peeled', 'trimmed', 'unprepared'];
  for (const word of redundant) {
    name = name.replace(new RegExp(`\\b${word}\\b[,\\s]*`, 'gi'), '');
  }

  // Step 4: Convert to title case if predominantly uppercase OR all lowercase
  const upperLetters = (name.match(/[A-Z]/g) || []).length;
  const allLetters = (name.match(/[A-Za-z]/g) || []).length;
  if (allLetters > 1 && (upperLetters / allLetters > 0.6 || upperLetters === 0)) {
    name = toTitleCase(name);
  }

  // Step 5: Collapse multiple spaces/commas and trim
  name = name
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/, '')
    .trim();

  return name || 'Unknown ingredient';
}

function toTitleCase(str: string): string {
  const minorWords = new Set([
    'and',
    'or',
    'the',
    'a',
    'an',
    'of',
    'in',
    'on',
    'at',
    'for',
    'to',
    'with',
  ]);
  return str
    .split(/\s+/)
    .map((word, idx) => {
      // Preserve special product tokens like 'n' in "Fruit 'n Yogurt"
      if (/^['']n['']?$/i.test(word)) return "'n";
      const lower = word.toLowerCase();
      if (idx > 0 && minorWords.has(lower)) return lower;
      // Handle words with internal apostrophes (McDonald's)
      return lower.replace(/(^|['-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}

/** Category icon mapping for grocery list */
export function getCategoryIcon(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('meat') || lower.includes('seafood')) return '🥩';
  if (lower.includes('dairy') || lower.includes('egg')) return '🥛';
  if (lower.includes('produce') || lower.includes('vegetable')) return '🥦';
  if (lower.includes('fruit')) return '🍎';
  if (lower.includes('grain') || lower.includes('bread')) return '🌾';
  if (lower.includes('legume') || lower.includes('plant protein')) return '🫘';
  if (lower.includes('oil') || lower.includes('condiment')) return '🫒';
  if (lower.includes('spice') || lower.includes('season')) return '🧂';
  if (lower.includes('nut') || lower.includes('seed')) return '🥜';
  return '🛒';
}
