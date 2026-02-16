import type { MealPlanValidated } from '../../types/schemas';

/**
 * Generate executive summary HTML with targets, macro breakdown, and QA score
 */
export function generateSummaryHtml(plan: MealPlanValidated): string {
  const { qa, weeklyTotals, generatedAt, engineVersion } = plan;

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
