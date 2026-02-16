import type { MealPlanValidated } from '../../types/schemas';
import { generateGroceryCategory } from './formatters';

/**
 * Generate grocery list HTML organized by store section
 */
export function generateGroceryHtml(plan: MealPlanValidated): string {
  const categoriesHtml = plan.groceryList.map((cat) => generateGroceryCategory(cat)).join('\n');

  const totalItems = plan.groceryList.reduce((sum, cat) => sum + cat.items.length, 0);

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
        <div class="summary-value">${totalItems}</div>
        <div class="summary-label">Total Items</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${plan.groceryList.length}</div>
        <div class="summary-label">Categories</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">7</div>
        <div class="summary-label">Days of Meals</div>
      </div>
    </div>

    <div class="categories">
      ${categoriesHtml}
    </div>
  </div>
</body>
</html>
    `.trim();
}
