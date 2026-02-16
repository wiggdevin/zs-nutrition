import puppeteer from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';
import { MealPlanValidated, CompiledDay, GroceryCategory } from '../types/schemas';

/**
 * Launch a browser instance, using @sparticuz/chromium in serverless
 * environments (AWS Lambda / Vercel) or Railway and the locally-installed
 * Chrome for development.
 */
async function getBrowser(): Promise<Browser> {
  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.RAILWAY_ENVIRONMENT
  ) {
    const chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }
  // Local development - use installed Chrome
  return puppeteer.launch({
    channel: 'chrome',
    headless: true,
  });
}

/**
 * Input size limits to prevent memory exhaustion and excessive rendering times.
 * These limits are generous for normal use but prevent abuse or edge cases.
 */
const RENDER_LIMITS = {
  MAX_DAYS: 14, // Maximum plan duration (2 weeks)
  MAX_MEALS_PER_DAY: 10, // Maximum meals per day (breakfast, lunch, dinner, + snacks)
  MAX_INGREDIENTS_PER_MEAL: 30, // Maximum ingredients in a single meal
} as const;

/**
 * Agent 6: Brand Renderer
 * Generates HTML and PDF deliverables from validated meal plan.
 * Outputs: executive summary, 7-day grid, grocery list, PDF buffer.
 */
export class BrandRenderer {
  async render(validated: MealPlanValidated): Promise<{
    summaryHtml: string;
    gridHtml: string;
    groceryHtml: string;
    pdfBuffer: Buffer;
  }> {
    // Validate input size to prevent memory exhaustion
    this.validateInputSize(validated);

    // 1. Generate executive summary HTML
    const summaryHtml = this.generateSummaryHtml(validated);

    // 2. Generate 7-day grid HTML
    const gridHtml = this.generateGridHtml(validated);

    // 3. Generate grocery list HTML
    const groceryHtml = this.generateGroceryHtml(validated);

    // 4. Generate PDF buffer combining all deliverables
    const pdfBuffer = await this.generatePdf(validated, summaryHtml, gridHtml, groceryHtml);

    return {
      summaryHtml,
      gridHtml,
      groceryHtml,
      pdfBuffer,
    };
  }

  /**
   * Validate input size to prevent memory exhaustion and excessive rendering times.
   * Throws an error if limits are exceeded.
   */
  private validateInputSize(validated: MealPlanValidated): void {
    // Check number of days
    if (validated.days.length > RENDER_LIMITS.MAX_DAYS) {
      throw new Error(
        `Plan too long: ${validated.days.length} days exceeds maximum of ${RENDER_LIMITS.MAX_DAYS} days`
      );
    }

    // Check meals per day and ingredients per meal
    for (const day of validated.days) {
      if (day.meals.length > RENDER_LIMITS.MAX_MEALS_PER_DAY) {
        throw new Error(
          `Too many meals on ${day.dayName} (Day ${day.dayNumber}): ` +
            `${day.meals.length} meals exceeds maximum of ${RENDER_LIMITS.MAX_MEALS_PER_DAY}`
        );
      }

      for (const meal of day.meals) {
        if (meal.ingredients && meal.ingredients.length > RENDER_LIMITS.MAX_INGREDIENTS_PER_MEAL) {
          throw new Error(
            `Too many ingredients in "${meal.name}" on ${day.dayName}: ` +
              `${meal.ingredients.length} ingredients exceeds maximum of ${RENDER_LIMITS.MAX_INGREDIENTS_PER_MEAL}`
          );
        }
      }
    }
  }

  /**
   * Generate a single PDF document combining all deliverables
   */
  private async generatePdf(
    validated: MealPlanValidated,
    summaryHtml: string,
    gridHtml: string,
    groceryHtml: string
  ): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
      browser = await getBrowser();

      const page = await browser.newPage();

      // Create a combined HTML document with all sections
      const combinedHtml = this.generateCombinedPdfHtml(
        validated,
        summaryHtml,
        gridHtml,
        groceryHtml
      );

      await page.setContent(combinedHtml, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm',
        },
        displayHeaderFooter: false,
      });

      // Convert Uint8Array to Buffer
      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate combined HTML for PDF with page breaks between sections
   */
  private generateCombinedPdfHtml(
    validated: MealPlanValidated,
    summaryHtml: string,
    gridHtml: string,
    groceryHtml: string
  ): string {
    // Extract body content from each HTML document
    const extractBody = (html: string) => {
      const match = html.match(/<body>([\s\S]*)<\/body>/);
      return match ? match[1] : html;
    };

    // Extract styles from each document
    const extractStyles = (html: string) => {
      const matches = html.match(/<style>([\s\S]*?)<\/style>/g);
      return matches ? matches.join('\n') : '';
    };

    const allStyles = `
      ${extractStyles(summaryHtml)}
      ${extractStyles(gridHtml)}
      ${extractStyles(groceryHtml)}
      <style>
        .pdf-section {
          page-break-after: always;
        }
        .pdf-section:last-child {
          page-break-after: avoid;
        }
      </style>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${allStyles}
  </style>
</head>
<body>
  <div class="pdf-section">
    ${extractBody(summaryHtml)}
  </div>
  <div class="pdf-section">
    ${extractBody(gridHtml)}
  </div>
  <div class="pdf-section">
    ${extractBody(groceryHtml)}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate executive summary HTML with targets, macro breakdown, and QA score
   */
  private generateSummaryHtml(plan: MealPlanValidated): string {
    const { qa, weeklyTotals, generatedAt, engineVersion } = plan;
    const _firstDay = plan.days[0];

    const qaBadgeColor = qa.status === 'PASS' ? 'green' : qa.status === 'WARN' ? 'orange' : 'red';
    const generatedDate = new Date(generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meal Plan Summary</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8fafc;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header .subtitle {
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 32px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .qa-badge {
      display: inline-block;
      background: ${qaBadgeColor};
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 24px;
      margin-bottom: 16px;
    }
    .qa-score {
      font-size: 48px;
      font-weight: 700;
      color: ${qaBadgeColor};
    }
    .qa-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .macro-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .macro-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .macro-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .macro-value {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    .macro-unit {
      font-size: 14px;
      color: #64748b;
      font-weight: 400;
    }
    .daily-targets {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
    .daily-targets h4 {
      color: #15803d;
      margin-bottom: 8px;
    }
    .daily-targets p {
      color: #166534;
      font-size: 14px;
    }
    .meta {
      background: #f1f5f9;
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      color: #64748b;
    }
    .meta p {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍽️ Your Personalized Meal Plan</h1>
      <p class="subtitle">7-Day Nutrition Plan • Generated ${generatedDate}</p>
    </div>

    <div class="content">
      <!-- QA Score Section -->
      <div class="section">
        <div class="section-title">Quality Assurance Score</div>
        <div style="text-align: center; padding: 24px 0;">
          <div class="qa-badge">${qa.status}</div>
          <div class="qa-score">${qa.score.toFixed(0)}%</div>
          <div class="qa-label">Overall Quality Score</div>
        </div>
      </div>

      <!-- Weekly Targets Section -->
      <div class="section">
        <div class="section-title">Weekly Average Targets</div>
        <div class="macro-grid">
          <div class="macro-card">
            <div class="macro-label">Calories</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgKcal)}</div>
            <div class="macro-unit">kcal/day</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Protein</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgProteinG)}</div>
            <div class="macro-unit">grams/day</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Carbs</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgCarbsG)}</div>
            <div class="macro-unit">grams/day</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Fat</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgFatG)}</div>
            <div class="macro-unit">grams/day</div>
          </div>
        </div>
        <div class="daily-targets">
          <h4>✓ Daily Targets Met</h4>
          <p>Your meal plan provides an average of ${Math.round(weeklyTotals.avgKcal)} calories per day, optimized for your goals.</p>
        </div>
      </div>

      <!-- Plan Meta -->
      <div class="section">
        <div class="section-title">Plan Details</div>
        <div class="meta">
          <p><strong>Generated:</strong> ${generatedDate}</p>
          <p><strong>Duration:</strong> ${plan.days.length} days</p>
          <p><strong>Total Meals:</strong> ${plan.days.reduce((sum, day) => sum + day.meals.length, 0)} meals</p>
          <p><strong>Engine Version:</strong> ${engineVersion}</p>
          <p><strong>QA Iterations:</strong> ${qa.iterations}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate 7-day grid HTML with visual calendar and meal cards
   */
  private generateGridHtml(plan: MealPlanValidated): string {
    const daysHtml = plan.days.map((day) => this.generateDayCard(day)).join('\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>7-Day Meal Plan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8fafc;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
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
    .days-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 24px;
    }
    .day-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .day-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-header.training-day {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    .day-title {
      font-size: 18px;
      font-weight: 600;
    }
    .day-badge {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .day-stats {
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      color: #64748b;
      display: flex;
      gap: 16px;
    }
    .day-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .day-stat strong {
      color: #1e293b;
    }
    .meals-list {
      padding: 16px;
    }
    .meal-item {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-left: 3px solid #667eea;
    }
    .meal-item:last-child {
      margin-bottom: 0;
    }
    .meal-slot {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .meal-name {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .meal-meta {
      font-size: 12px;
      color: #64748b;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .meal-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .cuisine-tag {
      background: #e0e7ff;
      color: #4338ca;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    @media (max-width: 768px) {
      .days-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Your 7-Day Meal Plan</h1>
      <p>Each day is optimized for your goals and preferences</p>
    </div>

    <div class="days-grid">
      ${daysHtml}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate a single day card HTML
   */
  private generateDayCard(day: CompiledDay): string {
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
   * Generate grocery list HTML organized by store section
   */
  private generateGroceryHtml(plan: MealPlanValidated): string {
    const categoriesHtml = plan.groceryList
      .map((cat) => this.generateGroceryCategory(cat))
      .join('\n');

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

  /**
   * Generate a single grocery category HTML
   */
  private generateGroceryCategory(category: GroceryCategory): string {
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
          <span>${this.getCategoryEmoji(category.category)} ${category.category}</span>
          <span class="category-count">${category.items.length} items</span>
        </div>
        <div class="items-list">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Get emoji for grocery category
   */
  private getCategoryEmoji(category: string): string {
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
}
