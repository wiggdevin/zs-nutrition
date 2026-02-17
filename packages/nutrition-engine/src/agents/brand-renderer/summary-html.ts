import type { MealPlanValidated } from '../../types/schemas';
import { escapeHtml } from './formatters';

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

  // Macro percentage calculations
  const proteinPercent =
    weeklyTotals.avgKcal > 0
      ? Math.round(((weeklyTotals.avgProteinG * 4) / weeklyTotals.avgKcal) * 100)
      : 0;
  const carbsPercent =
    weeklyTotals.avgKcal > 0
      ? Math.round(((weeklyTotals.avgCarbsG * 4) / weeklyTotals.avgKcal) * 100)
      : 0;
  const fatPercent =
    weeklyTotals.avgKcal > 0
      ? Math.round(((weeklyTotals.avgFatG * 9) / weeklyTotals.avgKcal) * 100)
      : 0;

  // Training vs rest day differential
  const trainingDays = plan.days.filter((d) => d.isTrainingDay);
  const restDays = plan.days.filter((d) => !d.isTrainingDay);

  const avgTrainingKcal =
    trainingDays.length > 0
      ? Math.round(trainingDays.reduce((s, d) => s + d.targetKcal, 0) / trainingDays.length)
      : 0;
  const avgRestKcal =
    restDays.length > 0
      ? Math.round(restDays.reduce((s, d) => s + d.targetKcal, 0) / restDays.length)
      : 0;

  const avgTrainingMacros =
    trainingDays.length > 0
      ? {
          protein: Math.round(
            trainingDays.reduce((s, d) => s + d.dailyTotals.proteinG, 0) / trainingDays.length
          ),
          carbs: Math.round(
            trainingDays.reduce((s, d) => s + d.dailyTotals.carbsG, 0) / trainingDays.length
          ),
          fat: Math.round(
            trainingDays.reduce((s, d) => s + d.dailyTotals.fatG, 0) / trainingDays.length
          ),
        }
      : null;

  const avgRestMacros =
    restDays.length > 0
      ? {
          protein: Math.round(
            restDays.reduce((s, d) => s + d.dailyTotals.proteinG, 0) / restDays.length
          ),
          carbs: Math.round(
            restDays.reduce((s, d) => s + d.dailyTotals.carbsG, 0) / restDays.length
          ),
          fat: Math.round(restDays.reduce((s, d) => s + d.dailyTotals.fatG, 0) / restDays.length),
        }
      : null;

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
    .macro-percent {
      font-size: 13px;
      color: #64748b;
      font-weight: 400;
    }
    .differential-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }
    .differential-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #e2e8f0;
    }
    .differential-card.training {
      border-left: 4px solid #f59e0b;
    }
    .differential-card.rest {
      border-left: 4px solid #667eea;
    }
    .differential-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }
    .differential-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
      padding: 4px 0;
    }
    .differential-row strong {
      color: #1e293b;
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
          <div class="qa-badge">${escapeHtml(qa.status)}</div>
          <div class="qa-score">${qa.score.toFixed(0)}%</div>
          <div class="qa-label">Overall Quality Score</div>
        </div>
      </div>

      <!-- Weekly Targets Section -->
      <div class="section">
        <div class="section-title">Weekly Average Targets</div>
        <div class="macro-grid">
          <div class="macro-card">
            <div class="macro-label">Daily Calories</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgKcal)}</div>
            <div class="macro-unit">kcal/day</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Protein Target</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgProteinG)}<span class="macro-unit">g</span></div>
            <div class="macro-percent">${proteinPercent}% of calories</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Carb Target</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgCarbsG)}<span class="macro-unit">g</span></div>
            <div class="macro-percent">${carbsPercent}% of calories</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">Fat Target</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgFatG)}<span class="macro-unit">g</span></div>
            <div class="macro-percent">${fatPercent}% of calories</div>
          </div>
          ${(() => {
            const totalFiber = plan.days.reduce(
              (sum, day) =>
                sum + day.meals.reduce((mSum, meal) => mSum + (meal.nutrition.fiberG || 0), 0),
              0
            );
            const avgFiber = plan.days.length > 0 ? Math.round(totalFiber / plan.days.length) : 0;
            return avgFiber > 0
              ? `<div class="macro-card">
            <div class="macro-label">Fiber Target</div>
            <div class="macro-value">${avgFiber}</div>
            <div class="macro-unit">grams/day</div>
          </div>`
              : '';
          })()}
        </div>
        <div class="daily-targets">
          <h4>✓ Daily Targets Met</h4>
          <p>Your meal plan provides an average of ${Math.round(weeklyTotals.avgKcal)} calories per day, optimized for your goals.</p>
        </div>

        ${
          trainingDays.length > 0 && restDays.length > 0
            ? `
        <div style="margin-top: 24px;">
          <div class="section-title">Training vs Rest Day Targets</div>
          <div class="differential-grid">
            <div class="differential-card training">
              <div class="differential-title">💪 Training Days (${trainingDays.length})</div>
              <div class="differential-row"><span>Calories</span><strong>${avgTrainingKcal} kcal</strong></div>
              ${
                avgTrainingMacros
                  ? `
              <div class="differential-row"><span>Protein</span><strong>${avgTrainingMacros.protein}g</strong></div>
              <div class="differential-row"><span>Carbs</span><strong>${avgTrainingMacros.carbs}g</strong></div>
              <div class="differential-row"><span>Fat</span><strong>${avgTrainingMacros.fat}g</strong></div>
              `
                  : ''
              }
            </div>
            <div class="differential-card rest">
              <div class="differential-title">🧘 Rest Days (${restDays.length})</div>
              <div class="differential-row"><span>Calories</span><strong>${avgRestKcal} kcal</strong></div>
              ${
                avgRestMacros
                  ? `
              <div class="differential-row"><span>Protein</span><strong>${avgRestMacros.protein}g</strong></div>
              <div class="differential-row"><span>Carbs</span><strong>${avgRestMacros.carbs}g</strong></div>
              <div class="differential-row"><span>Fat</span><strong>${avgRestMacros.fat}g</strong></div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
        `
            : ''
        }
      </div>

      ${
        plan.goalKcalFloorApplied
          ? `
      <!-- Caloric Floor Warning -->
      <div class="section">
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px;">
          <h4 style="color: #92400e; margin-bottom: 4px;">Caloric Floor Applied</h4>
          <p style="color: #78350f; font-size: 14px; margin: 0;">A minimum caloric floor was applied to meet safe daily intake guidelines. Your original calculated target was below recommended minimums.</p>
        </div>
      </div>
      `
          : ''
      }

      <!-- Calculation Methods -->
      <div class="section">
        <div class="section-title">Calculation Methods</div>
        <div class="meta">
          <p><strong>BMR Method:</strong> ${plan.calculationMethod === 'katch_mcardle' ? 'Katch-McArdle (body fat based)' : 'Mifflin-St Jeor (standard)'}</p>
          <p><strong>Protein Targeting:</strong> ${plan.proteinMethod === 'g_per_kg' ? 'Goal-based g/kg bodyweight' : 'Percentage-based'}</p>
        </div>
      </div>

      <!-- Plan Meta -->
      <div class="section">
        <div class="section-title">Plan Details</div>
        <div class="meta">
          <p><strong>Generated:</strong> ${generatedDate}</p>
          <p><strong>Duration:</strong> ${plan.days.length} days</p>
          <p><strong>Total Meals:</strong> ${plan.days.reduce((sum, day) => sum + day.meals.length, 0)} meals</p>
          <p><strong>Engine Version:</strong> ${escapeHtml(engineVersion)}</p>
          <p><strong>QA Iterations:</strong> ${qa.iterations}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
}
