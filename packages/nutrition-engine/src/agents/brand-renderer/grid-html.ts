import type { MealPlanValidated } from '../../types/schemas';
import { generateDayCard } from './formatters';

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
