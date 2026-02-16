import type { CompiledDay, GroceryCategory } from '../../types/schemas';

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
    .map(
      (meal) => `
      <div class="meal-item">
        <div class="meal-slot">${meal.slot}</div>
        <div class="meal-name">${meal.name}</div>
        <div class="meal-meta">
          <span>🔥 ${Math.round(meal.nutrition.kcal)} kcal</span>
          <span>💪 ${Math.round(meal.nutrition.proteinG)}g protein</span>
          <span>🍞 ${Math.round(meal.nutrition.carbsG)}g carbs</span>
          <span>🥑 ${Math.round(meal.nutrition.fatG)}g fat</span>
          <span class="cuisine-tag">${meal.cuisine}</span>
        </div>
      </div>
    `
    )
    .join('');

  return `
      <div class="day-card">
        <div class="day-header ${trainingClass}">
          <div class="day-title">${day.dayName}</div>
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
          <span class="item-name">${item.name}</span>
        </div>
        <span class="item-quantity">${item.amount} ${item.unit}</span>
      </div>
    `
    )
    .join('');

  return `
      <div class="category">
        <div class="category-header">
          <span>${getCategoryEmoji(category.category)} ${category.category}</span>
          <span class="category-count">${category.items.length} items</span>
        </div>
        <div class="items-list">
          ${itemsHtml}
        </div>
      </div>
    `;
}
