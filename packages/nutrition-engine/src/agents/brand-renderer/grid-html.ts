import type { MealPlanValidated } from '../../types/schemas';
import { generateDayCard } from './formatters';
import { BRAND, FONTS, GOOGLE_FONTS_LINK, sectionLabel } from './brand-constants';

/**
 * Generate 7-day grid HTML with visual calendar and meal cards
 */
export function generateGridHtml(plan: MealPlanValidated): string {
  const daysHtml = plan.days.map((day) => generateDayCard(day)).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${GOOGLE_FONTS_LINK}
  <title>7-Day Meal Plan</title>
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
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      font-family: ${FONTS.heading};
      font-size: 28px;
      color: ${BRAND.foreground};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 8px 0 0;
    }
    .header p {
      color: ${BRAND.muted};
      font-family: ${FONTS.body};
      font-size: 14px;
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
      background: ${BRAND.foreground};
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-header.training-day {
      background: linear-gradient(135deg, ${BRAND.trainingDay} 0%, #d97706 100%);
    }
    .day-title {
      font-family: ${FONTS.heading};
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .day-badge {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-family: ${FONTS.mono};
      font-size: 11px;
      font-weight: 500;
    }
    .day-stats {
      padding: 12px 20px;
      background: ${BRAND.cardBg};
      border-bottom: 1px solid ${BRAND.border};
      font-size: 13px;
      color: ${BRAND.muted};
      display: flex;
      gap: 16px;
      font-family: ${FONTS.body};
    }
    .day-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .day-stat strong {
      color: ${BRAND.foreground};
      font-family: ${FONTS.mono};
    }
    .meals-list {
      padding: 16px;
    }
    .meal-item {
      background: ${BRAND.cardBg};
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-left: 3px solid ${BRAND.primary};
    }
    .meal-item:last-child {
      margin-bottom: 0;
    }
    .meal-slot {
      font-family: ${FONTS.mono};
      font-size: 11px;
      color: ${BRAND.muted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .meal-name {
      font-family: ${FONTS.body};
      font-size: 15px;
      font-weight: 600;
      color: ${BRAND.foreground};
      margin-bottom: 4px;
    }
    .meal-meta {
      font-size: 12px;
      color: ${BRAND.muted};
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    .cuisine-tag {
      background: ${BRAND.primaryLightBg};
      color: ${BRAND.primaryDark};
      padding: 2px 8px;
      border-radius: 4px;
      font-family: ${FONTS.mono};
      font-size: 11px;
      font-weight: 500;
    }
    .protein-tag {
      background: #fef3c7;
      color: #92400e;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: ${FONTS.mono};
      font-size: 11px;
      font-weight: 500;
    }
    .confidence-badge {
      font-family: ${FONTS.mono};
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
      vertical-align: middle;
      margin-left: 4px;
    }
    .confidence-badge.verified {
      background: #dcfce7;
      color: #166534;
    }
    .confidence-badge.estimated {
      background: #fef9c3;
      color: #854d0e;
    }
    .meal-time {
      font-family: ${FONTS.mono};
      font-size: 12px;
      color: ${BRAND.muted};
      margin-top: 8px;
    }
    .meal-ingredients {
      margin-top: 8px;
      font-size: 13px;
    }
    .ingredients-title, .instructions-title {
      font-family: ${FONTS.mono};
      font-weight: 600;
      color: ${BRAND.muted};
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .ingredients-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .ingredients-list li {
      padding: 2px 0;
      color: ${BRAND.foreground};
      font-size: 13px;
      font-family: ${FONTS.body};
    }
    .ingredients-list li::before {
      content: '\\2022 ';
      color: ${BRAND.muted};
    }
    .meal-instructions {
      margin-top: 8px;
      font-size: 13px;
    }
    .instructions-list {
      padding-left: 20px;
      margin: 0;
    }
    .instructions-list li {
      padding: 4px 0;
      color: ${BRAND.foreground};
      font-size: 13px;
      font-family: ${FONTS.body};
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      min-width: 22px;
      background: ${BRAND.primary};
      color: white;
      border-radius: 50%;
      font-family: ${FONTS.mono};
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
    }
    .cooking-verb {
      background: #fef3c7;
      color: #92400e;
      padding: 0 3px;
      border-radius: 3px;
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
      ${sectionLabel('7-DAY MEAL PLAN')}
      <h1>Daily Breakdown</h1>
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
