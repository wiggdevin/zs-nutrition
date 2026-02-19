import type { MealPlanValidated } from '../../types/schemas';
import { escapeHtml } from './formatters';
import { BRAND, FONTS, GOOGLE_FONTS_LINK, logoHtml, sectionLabel } from './brand-constants';

/**
 * Generate an inline SVG donut chart showing protein/carbs/fat proportions.
 */
function macroDonutSvg(proteinPct: number, carbsPct: number, fatPct: number): string {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const gap = 4; // gap in degrees between arcs

  const total = proteinPct + carbsPct + fatPct;
  if (total === 0) return '';

  // Normalize to 360 degrees minus gaps
  const gapDeg = gap * 3;
  const available = 360 - gapDeg;
  const proteinDeg = (proteinPct / total) * available;
  const carbsDeg = (carbsPct / total) * available;
  const fatDeg = (fatPct / total) * available;

  const proteinDash = (proteinDeg / 360) * circumference;
  const carbsDash = (carbsDeg / 360) * circumference;
  const fatDash = (fatDeg / 360) * circumference;

  const gapDash = (gap / 360) * circumference;

  // Offsets: each arc starts after the previous arc + gap
  const proteinOffset = 0;
  const carbsOffset = -(proteinDash + gapDash);
  const fatOffset = -(proteinDash + gapDash + carbsDash + gapDash);

  return `
  <div style="text-align:center;margin:24px 0;">
    <svg width="160" height="160" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="10"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${BRAND.protein}" stroke-width="10"
        stroke-dasharray="${proteinDash} ${circumference}" stroke-dashoffset="${proteinOffset}"
        transform="rotate(-90 60 60)" stroke-linecap="round"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${BRAND.carbs}" stroke-width="10"
        stroke-dasharray="${carbsDash} ${circumference}" stroke-dashoffset="${carbsOffset}"
        transform="rotate(-90 60 60)" stroke-linecap="round"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${BRAND.fat}" stroke-width="10"
        stroke-dasharray="${fatDash} ${circumference}" stroke-dashoffset="${fatOffset}"
        transform="rotate(-90 60 60)" stroke-linecap="round"/>
    </svg>
    <div style="display:flex;justify-content:center;gap:20px;margin-top:12px;font-family:${FONTS.body};font-size:12px;color:${BRAND.muted};">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${BRAND.protein};margin-right:4px;vertical-align:middle;"></span>Protein ${proteinPct}%</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${BRAND.carbs};margin-right:4px;vertical-align:middle;"></span>Carbs ${carbsPct}%</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${BRAND.fat};margin-right:4px;vertical-align:middle;"></span>Fat ${fatPct}%</span>
    </div>
  </div>`;
}

/**
 * Generate executive summary HTML with targets, macro breakdown, and QA score
 */
export function generateSummaryHtml(plan: MealPlanValidated): string {
  const { qa, weeklyTotals, generatedAt, engineVersion } = plan;

  const qaBadgeColor =
    qa.status === 'PASS' ? '#22c55e' : qa.status === 'WARN' ? '#f59e0b' : '#ef4444';
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
  ${GOOGLE_FONTS_LINK}
  <title>Meal Plan Summary</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${FONTS.body};
      background: #f8fafc;
      padding: 20px;
      line-height: 1.6;
      color: ${BRAND.foreground};
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
      background: white;
      padding: 32px;
      border-bottom: 3px solid ${BRAND.primary};
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header-date {
      font-family: ${FONTS.mono};
      font-size: 12px;
      color: ${BRAND.muted};
    }
    .header h1 {
      font-family: ${FONTS.heading};
      font-size: 28px;
      text-transform: uppercase;
      color: ${BRAND.foreground};
      margin: 8px 0 4px;
      letter-spacing: 1px;
    }
    .header .subtitle {
      font-family: ${FONTS.mono};
      font-size: 13px;
      color: ${BRAND.muted};
    }
    .content {
      padding: 32px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-family: ${FONTS.heading};
      font-size: 14px;
      text-transform: uppercase;
      color: ${BRAND.foreground};
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${BRAND.border};
      letter-spacing: 1px;
    }
    .qa-badge {
      display: inline-block;
      background: ${qaBadgeColor};
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: ${FONTS.heading};
      font-size: 14px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .qa-score {
      font-family: ${FONTS.mono};
      font-size: 48px;
      font-weight: 700;
      color: ${qaBadgeColor};
    }
    .qa-label {
      font-size: 12px;
      color: ${BRAND.muted};
      text-transform: uppercase;
      letter-spacing: 2px;
      font-family: ${FONTS.mono};
    }
    .macro-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .macro-card {
      background: ${BRAND.cardBg};
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid ${BRAND.border};
    }
    .macro-card.cal { border-top: 3px solid ${BRAND.calories}; }
    .macro-card.protein { border-top: 3px solid ${BRAND.protein}; }
    .macro-card.carbs { border-top: 3px solid ${BRAND.carbs}; }
    .macro-card.fat { border-top: 3px solid ${BRAND.fat}; }
    .macro-card.fiber { border-top: 3px solid ${BRAND.muted}; }
    .macro-label {
      font-family: ${FONTS.mono};
      font-size: 11px;
      color: ${BRAND.muted};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .macro-value {
      font-family: ${FONTS.mono};
      font-size: 24px;
      font-weight: 700;
      color: ${BRAND.foreground};
    }
    .macro-unit {
      font-family: ${FONTS.mono};
      font-size: 14px;
      color: ${BRAND.muted};
      font-weight: 400;
    }
    .daily-targets {
      background: ${BRAND.primaryLightBg};
      border-left: 4px solid ${BRAND.primary};
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
    .daily-targets h4 {
      color: ${BRAND.primaryDark};
      margin-bottom: 8px;
      font-family: ${FONTS.body};
    }
    .daily-targets p {
      color: ${BRAND.primaryDark};
      font-size: 14px;
    }
    .meta {
      background: ${BRAND.cardBg};
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      color: ${BRAND.muted};
      font-family: ${FONTS.body};
    }
    .meta p {
      margin-bottom: 4px;
    }
    .meta strong {
      color: ${BRAND.foreground};
    }
    .macro-percent {
      font-family: ${FONTS.mono};
      font-size: 12px;
      color: ${BRAND.muted};
      font-weight: 400;
    }
    .differential-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }
    .differential-card {
      background: ${BRAND.cardBg};
      border-radius: 8px;
      padding: 20px;
      border: 1px solid ${BRAND.border};
    }
    .differential-card.training {
      border-left: 4px solid ${BRAND.trainingDay};
    }
    .differential-card.rest {
      border-left: 4px solid ${BRAND.restDay};
    }
    .differential-title {
      font-family: ${FONTS.body};
      font-size: 14px;
      font-weight: 600;
      color: ${BRAND.foreground};
      margin-bottom: 12px;
    }
    .differential-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: ${BRAND.muted};
      padding: 4px 0;
      font-family: ${FONTS.body};
    }
    .differential-row strong {
      color: ${BRAND.foreground};
      font-family: ${FONTS.mono};
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        ${logoHtml('md')}
        <span class="header-date">${generatedDate}</span>
      </div>
      ${sectionLabel('YOUR NUTRITION PLAN')}
      <h1>7-Day Meal Plan</h1>
      <p class="subtitle">${Math.round(weeklyTotals.avgKcal)} kcal/day avg</p>
    </div>

    <div class="content">
      <!-- QA Score Section -->
      <div class="section">
        <div class="section-title">${sectionLabel('QUALITY ASSURANCE')}</div>
        <div style="text-align: center; padding: 24px 0;">
          <div class="qa-badge">${escapeHtml(qa.status)}</div>
          <div class="qa-score">${qa.score.toFixed(0)}%</div>
          <div class="qa-label">Overall Quality Score</div>
        </div>
      </div>

      <!-- Weekly Targets Section -->
      <div class="section">
        <div class="section-title">${sectionLabel('WEEKLY TARGETS')}</div>
        <div class="macro-grid">
          <div class="macro-card cal">
            <div class="macro-label">Daily Calories</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgKcal)}</div>
            <div class="macro-unit">kcal/day</div>
          </div>
          <div class="macro-card protein">
            <div class="macro-label">Protein Target</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgProteinG)}<span class="macro-unit">g</span></div>
            <div class="macro-percent">${proteinPercent}% of calories</div>
          </div>
          <div class="macro-card carbs">
            <div class="macro-label">Carb Target</div>
            <div class="macro-value">${Math.round(weeklyTotals.avgCarbsG)}<span class="macro-unit">g</span></div>
            <div class="macro-percent">${carbsPercent}% of calories</div>
          </div>
          <div class="macro-card fat">
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
              ? `<div class="macro-card fiber">
            <div class="macro-label">Fiber Target</div>
            <div class="macro-value">${avgFiber}</div>
            <div class="macro-unit">grams/day</div>
          </div>`
              : '';
          })()}
        </div>

        ${macroDonutSvg(proteinPercent, carbsPercent, fatPercent)}

        <div class="daily-targets">
          <h4>Daily Targets Met</h4>
          <p>Your meal plan provides an average of ${Math.round(weeklyTotals.avgKcal)} calories per day, optimized for your goals.</p>
        </div>

        ${
          trainingDays.length > 0 && restDays.length > 0
            ? `
        <div style="margin-top: 24px;">
          <div class="section-title">${sectionLabel('TRAINING VS REST')}</div>
          <div class="differential-grid">
            <div class="differential-card training">
              <div class="differential-title">Training Days (${trainingDays.length})</div>
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
              <div class="differential-title">Rest Days (${restDays.length})</div>
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
        <div style="background: #fef3c7; border-left: 4px solid ${BRAND.trainingDay}; padding: 16px; border-radius: 4px;">
          <h4 style="color: #92400e; margin-bottom: 4px; font-family: ${FONTS.body};">Caloric Floor Applied</h4>
          <p style="color: #78350f; font-size: 14px; margin: 0;">A minimum caloric floor was applied to meet safe daily intake guidelines. Your original calculated target was below recommended minimums.</p>
        </div>
      </div>
      `
          : ''
      }

      <!-- Calculation Methods -->
      <div class="section">
        <div class="section-title">${sectionLabel('CALCULATION METHODS')}</div>
        <div class="meta">
          <p><strong>BMR Method:</strong> ${plan.calculationMethod === 'katch_mcardle' ? 'Katch-McArdle (body fat based)' : 'Mifflin-St Jeor (standard)'}</p>
          <p><strong>Protein Targeting:</strong> ${plan.proteinMethod === 'g_per_kg' ? 'Goal-based g/kg bodyweight' : 'Percentage-based'}</p>
        </div>
      </div>

      <!-- Plan Meta -->
      <div class="section">
        <div class="section-title">${sectionLabel('PLAN DETAILS')}</div>
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
