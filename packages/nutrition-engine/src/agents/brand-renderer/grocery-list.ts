import type { MealPlanValidated, GroceryCategory } from '../../types/schemas';
import { generateGroceryCategory, escapeHtml, formatAmount } from './formatters';

/**
 * Items commonly already in a home pantry. Matched case-insensitively.
 */
const PANTRY_STAPLES = new Set([
  'salt',
  'pepper',
  'black pepper',
  'olive oil',
  'cooking spray',
  'water',
  'ice',
  'vegetable oil',
  'canola oil',
  'nonstick spray',
]);

function isPantryStaple(name: string): boolean {
  return PANTRY_STAPLES.has(name.toLowerCase().trim());
}

/**
 * Separate pantry staples from items to buy, returning modified categories
 * and a flat list of staple items.
 */
function separatePantryStaples(groceryList: GroceryCategory[]): {
  filteredCategories: GroceryCategory[];
  pantryItems: Array<{ name: string; amount: number; unit: string }>;
} {
  const pantryItems: Array<{ name: string; amount: number; unit: string }> = [];
  const filteredCategories: GroceryCategory[] = [];

  for (const cat of groceryList) {
    const staples = cat.items.filter((item) => isPantryStaple(item.name));
    const toBuy = cat.items.filter((item) => !isPantryStaple(item.name));
    pantryItems.push(...staples);
    if (toBuy.length > 0) {
      filteredCategories.push({ ...cat, items: toBuy });
    }
  }

  return { filteredCategories, pantryItems };
}

/**
 * Generate grocery list HTML organized by store section
 */
export function generateGroceryHtml(plan: MealPlanValidated): string {
  const { filteredCategories, pantryItems } = separatePantryStaples(plan.groceryList);

  const categoriesHtml = filteredCategories.map((cat) => generateGroceryCategory(cat)).join('\n');

  const pantryHtml =
    pantryItems.length > 0
      ? `<div class="category pantry-staples">
        <div class="category-header" style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);">
          <span>🏠 Pantry Staples (likely on hand)</span>
          <span class="category-count">${pantryItems.length} items</span>
        </div>
        <div class="items-list">
          ${pantryItems
            .map(
              (item) => `
          <div class="item pantry-item">
            <div style="display: flex; align-items: center; flex: 1;">
              <input type="checkbox" class="checkbox" checked disabled />
              <span class="item-name" style="color: #94a3b8;">${escapeHtml(item.name)}</span>
            </div>
            <span class="item-quantity" style="background: #f1f5f9; color: #94a3b8;">${formatAmount(item.amount)} ${escapeHtml(item.unit)}</span>
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>`
      : '';

  const totalItems = plan.groceryList.reduce((sum, cat) => sum + cat.items.length, 0);
  const toBuyCount = totalItems - pantryItems.length;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grocery List</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8fafc;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      font-size: 32px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .header p {
      color: #64748b;
    }
    .summary {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    .summary-item {
      flex: 1;
    }
    .summary-value {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
    }
    .summary-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .categories {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .category {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .category-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .category-count {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
    }
    .items-list {
      padding: 16px 20px;
    }
    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-size: 15px;
      color: #1e293b;
      font-weight: 500;
    }
    .item-quantity {
      font-size: 14px;
      color: #667eea;
      font-weight: 600;
      background: #eef2ff;
      padding: 6px 12px;
      border-radius: 6px;
    }
    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #cbd5e1;
      border-radius: 4px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .category {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 Weekly Grocery List</h1>
      <p>Everything you need for your 7-day meal plan</p>
    </div>

    <div class="summary">
      <div class="summary-item">
        <div class="summary-value">${toBuyCount}</div>
        <div class="summary-label">Items to Buy</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${filteredCategories.length}</div>
        <div class="summary-label">Categories</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">7</div>
        <div class="summary-label">Days of Meals</div>
      </div>
    </div>

    <div class="categories">
      ${categoriesHtml}
      ${pantryHtml}
    </div>
  </div>
</body>
</html>
    `.trim();
}
