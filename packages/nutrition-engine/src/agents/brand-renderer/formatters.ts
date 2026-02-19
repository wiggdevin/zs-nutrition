import type { CompiledDay, GroceryCategory } from '../../types/schemas';
import { BRAND, FONTS } from './brand-constants';

/**
 * Escape HTML special characters to prevent XSS in rendered output.
 * Apply to all user-supplied and AI-generated strings before interpolation
 * into HTML templates. Numeric values do not need escaping.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Common fraction mappings for readable ingredient amounts.
 */
const FRACTION_MAP: [number, string][] = [
  [0.25, '1/4'],
  [0.33, '1/3'],
  [0.5, '1/2'],
  [0.67, '2/3'],
  [0.75, '3/4'],
];

/**
 * Format a numeric amount into a human-readable string with fractions.
 * Examples: 0.5 → "1/2", 1.5 → "1 1/2", 2 → "2", 0.33 → "1/3"
 */
export function formatAmount(amount: number): string {
  if (amount <= 0) return '0';

  const whole = Math.floor(amount);
  const decimal = amount - whole;

  // Pure whole number
  if (decimal < 0.01) return whole.toString();

  // Find closest fraction (within tolerance of 0.05)
  const fraction = FRACTION_MAP.find(([val]) => Math.abs(decimal - val) < 0.05);

  if (fraction) {
    return whole > 0 ? `${whole} ${fraction[1]}` : fraction[1];
  }

  // No matching fraction — use one decimal place
  return amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
}

/**
 * Cooking verbs to highlight in instruction steps.
 */
const COOKING_VERBS = [
  'saut[eé]',
  'bake',
  'grill',
  'roast',
  'simmer',
  'boil',
  'fry',
  'steam',
  'broil',
  'poach',
  'braise',
  'blanch',
  'sear',
  'whisk',
  'fold',
  'dice',
  'mince',
  'chop',
  'slice',
  'julienne',
];

const COOKING_VERB_REGEX = new RegExp(`\\b(${COOKING_VERBS.join('|')})(s|ed|ing|e)?\\b`, 'gi');

/**
 * Highlight cooking verbs in an instruction step with a CSS class.
 */
function highlightCookingVerbs(step: string): string {
  return step.replace(COOKING_VERB_REGEX, '<span class="cooking-verb">$&</span>');
}

/**
 * Get emoji for grocery category
 */
export function getCategoryEmoji(category: string): string {
  const emojiMap: { [key: string]: string } = {
    produce: '🥬',
    vegetables: '🥦',
    fruits: '🍎',
    meat: '🥩',
    seafood: '🦐',
    dairy: '🧀',
    eggs: '🥚',
    bakery: '🍞',
    pantry: '🥫',
    grains: '🌾',
    spices: '🧂',
    frozen: '❄️',
    beverages: '🥤',
    snacks: '🍿',
    other: '🛒',
  };
  return emojiMap[category.toLowerCase()] || '🛒';
}

/**
 * Format a macro value with its brand color (monospace).
 */
function colorMacro(value: number, unit: string, color: string): string {
  return `<span style="font-family:${FONTS.mono};color:${color};font-weight:600;font-size:12px;">${Math.round(value)}${unit}</span>`;
}

/**
 * Generate a single day card HTML
 */
export function generateDayCard(day: CompiledDay): string {
  const trainingClass = day.isTrainingDay ? 'training-day' : '';
  const trainingBadge = day.isTrainingDay ? 'Training Day' : 'Rest Day';
  const variancePercent = Math.abs(day.variancePercent);
  const varianceColor =
    variancePercent < 5 ? '#22c55e' : variancePercent < 10 ? '#f59e0b' : '#ef4444';

  const mealsHtml = day.meals
    .map((meal) => {
      const confidenceBadge =
        meal.confidenceLevel === 'verified'
          ? '<span class="confidence-badge verified">Verified</span>'
          : '<span class="confidence-badge estimated">AI Estimated</span>';

      const timeHtml =
        meal.prepTimeMin > 0 || meal.cookTimeMin > 0
          ? `<div class="meal-time">Prep: ${meal.prepTimeMin}min &bull; Cook: ${meal.cookTimeMin}min</div>`
          : '';

      const primaryProteinLower = meal.primaryProtein.toLowerCase();
      const ingredientsHtml =
        meal.ingredients.length > 0
          ? `<div class="meal-ingredients">
              <div class="ingredients-title">Ingredients:</div>
              <ul class="ingredients-list">
                ${meal.ingredients
                  .map((ing) => {
                    const isPrimary =
                      primaryProteinLower && ing.name.toLowerCase().includes(primaryProteinLower);
                    const nameHtml = isPrimary
                      ? `<strong>${escapeHtml(ing.name)}</strong>`
                      : escapeHtml(ing.name);
                    return `<li>${formatAmount(ing.amount)} ${escapeHtml(ing.unit)} ${nameHtml}</li>`;
                  })
                  .join('\n                ')}
              </ul>
            </div>`
          : '';

      const instructionsHtml =
        meal.instructions.length > 0
          ? `<div class="meal-instructions">
              <div class="instructions-title">Instructions:</div>
              <ol class="instructions-list">
                ${meal.instructions.map((step, i) => `<li><span class="step-number">${i + 1}</span>${highlightCookingVerbs(escapeHtml(step))}</li>`).join('\n                ')}
              </ol>
            </div>`
          : '';

      return `
      <div class="meal-item">
        <div class="meal-slot">${escapeHtml(meal.slot)}</div>
        <div class="meal-name">${escapeHtml(meal.name)} ${confidenceBadge}</div>
        <div class="meal-meta">
          ${colorMacro(meal.nutrition.kcal, ' kcal', BRAND.calories)}
          ${colorMacro(meal.nutrition.proteinG, 'g P', BRAND.protein)}
          ${colorMacro(meal.nutrition.carbsG, 'g C', BRAND.carbs)}
          ${colorMacro(meal.nutrition.fatG, 'g F', BRAND.fat)}
          <span class="protein-tag">${escapeHtml(meal.primaryProtein)}</span>
          <span class="cuisine-tag">${escapeHtml(meal.cuisine)}</span>
        </div>
        ${timeHtml}
        ${ingredientsHtml}
        ${instructionsHtml}
      </div>
    `;
    })
    .join('');

  return `
      <div class="day-card">
        <div class="day-header ${trainingClass}">
          <div class="day-title">${escapeHtml(day.dayName)}</div>
          <div class="day-badge">${trainingBadge}</div>
        </div>
        <div class="day-stats">
          <div class="day-stat">
            Target: <strong>${Math.round(day.targetKcal)} kcal</strong>
          </div>
          <div class="day-stat">
            Actual: <strong>${Math.round(day.dailyTotals.kcal)} kcal</strong>
          </div>
          <div class="day-stat">
            Variance: <strong style="color: ${varianceColor}">${day.variancePercent > 0 ? '+' : ''}${day.variancePercent.toFixed(1)}%</strong>
          </div>
        </div>
        <div class="meals-list">
          ${mealsHtml}
        </div>
      </div>
    `;
}

/**
 * Generate a single grocery category HTML
 */
export function generateGroceryCategory(category: GroceryCategory): string {
  const itemsHtml = category.items
    .map(
      (item) => `
      <div class="item">
        <div style="display: flex; align-items: center; flex: 1;">
          <span class="checkbox-print"></span>
          <span class="item-name">${escapeHtml(item.name)}</span>
        </div>
        <span class="item-quantity">${formatAmount(item.amount)} ${escapeHtml(item.unit)}</span>
      </div>
    `
    )
    .join('');

  return `
      <div class="category">
        <div class="category-header">
          <span>${getCategoryEmoji(category.category)} ${escapeHtml(category.category)}</span>
          <span class="category-count">${category.items.length} items</span>
        </div>
        <div class="items-list">
          ${itemsHtml}
        </div>
      </div>
    `;
}
