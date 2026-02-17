import type { CompiledDay, GroceryCategory } from '../../types/schemas';

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
 * Generate a single day card HTML
 */
export function generateDayCard(day: CompiledDay): string {
  const trainingClass = day.isTrainingDay ? 'training-day' : '';
  const trainingBadge = day.isTrainingDay ? '💪 Training Day' : '🧘 Rest Day';
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
          ? `<div class="meal-time">⏱️ Prep: ${meal.prepTimeMin}min • Cook: ${meal.cookTimeMin}min</div>`
          : '';

      const ingredientsHtml =
        meal.ingredients.length > 0
          ? `<div class="meal-ingredients">
              <div class="ingredients-title">Ingredients:</div>
              <ul class="ingredients-list">
                ${meal.ingredients.map((ing) => `<li>${ing.amount} ${escapeHtml(ing.unit)} ${escapeHtml(ing.name)}</li>`).join('\n                ')}
              </ul>
            </div>`
          : '';

      const instructionsHtml =
        meal.instructions.length > 0
          ? `<div class="meal-instructions">
              <div class="instructions-title">Instructions:</div>
              <ol class="instructions-list">
                ${meal.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('\n                ')}
              </ol>
            </div>`
          : '';

      return `
      <div class="meal-item">
        <div class="meal-slot">${escapeHtml(meal.slot)}</div>
        <div class="meal-name">${escapeHtml(meal.name)} ${confidenceBadge}</div>
        <div class="meal-meta">
          <span>🔥 ${Math.round(meal.nutrition.kcal)} kcal</span>
          <span>💪 ${Math.round(meal.nutrition.proteinG)}g protein</span>
          <span>🍞 ${Math.round(meal.nutrition.carbsG)}g carbs</span>
          <span>🥑 ${Math.round(meal.nutrition.fatG)}g fat</span>
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
          <input type="checkbox" class="checkbox" />
          <span class="item-name">${escapeHtml(item.name)}</span>
        </div>
        <span class="item-quantity">${item.amount} ${escapeHtml(item.unit)}</span>
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
