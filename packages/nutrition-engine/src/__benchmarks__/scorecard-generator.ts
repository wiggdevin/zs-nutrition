/**
 * Scorecard Generator
 *
 * Generates markdown scorecards from ScorecardResult objects.
 * Output format matches existing scorecards (e.g., ingredient-level-scorecard-marcus.md).
 */

import type { ScorecardResult, CategoryScore } from './scoring';

function formatSign(n: number): string {
  return n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
}

function catLabel(key: string): string {
  const labels: Record<string, string> = {
    nutritionalAccuracy: 'A: Nutritional Accuracy',
    mealPracticality: 'B: Meal Practicality',
    dietaryCompliance: 'C: Dietary Compliance',
    variety: 'D: Variety & Experience',
    groceryFeasibility: 'E: Grocery Feasibility',
  };
  return labels[key] ?? key;
}

function weightPct(w: number): string {
  return `${Math.round(w * 100)}%`;
}

export function generateScorecard(result: ScorecardResult): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  lines.push(`# USDA-Only Scorecard: ${result.persona}`);
  lines.push('');
  lines.push(`> **Date:** ${dateStr}`);
  lines.push('> **Test:** USDA-only pipeline evaluation (no FatSecret)');
  lines.push(`> **QA Score:** ${result.qaScore}/100 (${result.qaStatus})`);
  lines.push(`> **Pipeline Time:** ${(result.pipelineTimeMs / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Pipeline Results Summary
  lines.push('## Pipeline Results');
  lines.push('');
  const cov = result.ingredientCoverage;
  const matchPct = (cov.matchRate * 100).toFixed(1);
  lines.push(
    `- **Coverage:** ${cov.total} ingredients, ${cov.matchedUSDA} USDA, ${cov.matchedFatSecret} FatSecret, ${cov.unverified} unverified (${matchPct}% match rate)`
  );
  lines.push(
    `- **Meals:** ${cov.mealsVerified}/${cov.totalMeals} verified, ${cov.mealsAiEstimated} ai_estimated`
  );

  const totalViolations = result.allergenViolations.length + result.dietaryViolations.length;
  if (totalViolations === 0) {
    lines.push('- **Allergen/Dietary Violations:** None');
  } else {
    lines.push(`- **Allergen Violations:** ${result.allergenViolations.length}`);
    lines.push(`- **Dietary Violations:** ${result.dietaryViolations.length}`);
  }
  lines.push('');

  // Daily Calorie & Macro Adherence Table
  lines.push('## Daily Calorie & Macro Adherence');
  lines.push('');
  lines.push(
    '| Day | Training | Target | Actual | Kcal Var | Protein (T/A) | Carbs (T/A) | Fat (T/A) |'
  );
  lines.push(
    '|-----|----------|--------|--------|----------|---------------|-------------|-----------|'
  );

  for (const d of result.dailyAdherence) {
    const train = d.isTrainingDay ? 'Yes' : 'No';
    lines.push(
      `| ${d.day} | ${train} | ${d.targetKcal} | ${Math.round(d.actualKcal)} | ${formatSign(d.variancePercent)} | ${Math.round(d.targetProtein)}/${Math.round(d.actualProtein)}g | ${Math.round(d.targetCarbs)}/${Math.round(d.actualCarbs)}g | ${Math.round(d.targetFat)}/${Math.round(d.actualFat)}g |`
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Category Scores
  lines.push('## Category Scores');
  lines.push('');

  const categories = result.categories;
  const catEntries: [string, CategoryScore][] = [
    ['nutritionalAccuracy', categories.nutritionalAccuracy],
    ['mealPracticality', categories.mealPracticality],
    ['dietaryCompliance', categories.dietaryCompliance],
    ['variety', categories.variety],
    ['groceryFeasibility', categories.groceryFeasibility],
  ];

  for (const [key, cat] of catEntries) {
    lines.push(`### ${catLabel(key)} — ${cat.score}/10 (Weight: ${weightPct(cat.weight)})`);
    lines.push(cat.evidence);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Composite Score Table
  lines.push('## Composite Score');
  lines.push('');
  lines.push('| Category | Score | Weight | Weighted |');
  lines.push('|----------|-------|--------|----------|');

  for (const [key, cat] of catEntries) {
    lines.push(
      `| ${catLabel(key)} | ${cat.score} | ${weightPct(cat.weight)} | ${cat.weighted.toFixed(2)} |`
    );
  }
  lines.push(`| **Total** | | | **${result.composite.toFixed(2)}** |`);
  lines.push('');
  lines.push(`**Grade: ${result.grade}**`);
  lines.push('');

  // Violations detail
  if (result.allergenViolations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Allergen Violations');
    lines.push('');
    for (const v of result.allergenViolations) {
      lines.push(`- ${v}`);
    }
    lines.push('');
  }

  if (result.dietaryViolations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Dietary Style Violations');
    lines.push('');
    for (const v of result.dietaryViolations) {
      lines.push(`- ${v}`);
    }
    lines.push('');
  }

  // Unmatched Ingredients
  if (result.unmatchedIngredients.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Unmatched Ingredients');
    lines.push('');
    for (const name of result.unmatchedIngredients) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// Comparison Table Generator
// ============================================================

export function generateComparisonTable(results: ScorecardResult[]): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  lines.push('# USDA-Only Pipeline Comparison');
  lines.push('');
  lines.push(`> **Date:** ${dateStr}`);
  lines.push('> **Test:** USDA-only pipeline evaluation (no FatSecret)');
  lines.push(`> **Personas:** ${results.map((r) => r.persona).join(', ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary table
  lines.push('## Overall Scores');
  lines.push('');
  lines.push('| Persona | Composite | Grade | QA Score | Match Rate | Time |');
  lines.push('|---------|-----------|-------|----------|------------|------|');

  for (const r of results) {
    const matchPct = (r.ingredientCoverage.matchRate * 100).toFixed(1);
    const time = (r.pipelineTimeMs / 1000).toFixed(0);
    lines.push(
      `| ${r.persona} | ${r.composite.toFixed(2)} | ${r.grade} | ${r.qaScore} | ${matchPct}% | ${time}s |`
    );
  }
  lines.push('');

  // Category breakdown
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push(
    '| Persona | A: Accuracy | B: Practical | C: Compliance | D: Variety | E: Grocery | Composite |'
  );
  lines.push(
    '|---------|-------------|--------------|---------------|------------|------------|-----------|'
  );

  for (const r of results) {
    const c = r.categories;
    lines.push(
      `| ${r.slug} | ${c.nutritionalAccuracy.score}/10 | ${c.mealPracticality.score}/10 | ${c.dietaryCompliance.score}/10 | ${c.variety.score}/10 | ${c.groceryFeasibility.score}/10 | ${r.composite.toFixed(2)} |`
    );
  }
  lines.push('');

  // Coverage comparison
  lines.push('## Ingredient Coverage');
  lines.push('');
  lines.push('| Persona | Total | USDA | FatSecret | Unverified | Match Rate | Verified Meals |');
  lines.push('|---------|-------|------|-----------|------------|------------|----------------|');

  for (const r of results) {
    const cov = r.ingredientCoverage;
    const matchPct = (cov.matchRate * 100).toFixed(1);
    lines.push(
      `| ${r.slug} | ${cov.total} | ${cov.matchedUSDA} | ${cov.matchedFatSecret} | ${cov.unverified} | ${matchPct}% | ${cov.mealsVerified}/${cov.totalMeals} |`
    );
  }
  lines.push('');

  // Violations
  lines.push('## Violations Summary');
  lines.push('');
  lines.push('| Persona | Allergen | Dietary | Total |');
  lines.push('|---------|----------|---------|-------|');

  for (const r of results) {
    lines.push(
      `| ${r.slug} | ${r.allergenViolations.length} | ${r.dietaryViolations.length} | ${r.allergenViolations.length + r.dietaryViolations.length} |`
    );
  }
  lines.push('');

  // Averages
  if (results.length > 0) {
    const avgComposite = results.reduce((s, r) => s + r.composite, 0) / results.length;
    const avgMatch =
      results.reduce((s, r) => s + r.ingredientCoverage.matchRate, 0) / results.length;
    const avgTime = results.reduce((s, r) => s + r.pipelineTimeMs, 0) / results.length;

    lines.push('## Averages');
    lines.push('');
    lines.push(`- **Avg Composite Score:** ${avgComposite.toFixed(2)}`);
    lines.push(`- **Avg Match Rate:** ${(avgMatch * 100).toFixed(1)}%`);
    lines.push(`- **Avg Pipeline Time:** ${(avgTime / 1000).toFixed(0)}s`);
    lines.push('');
  }

  // Common unmatched
  const allUnmatched: Record<string, number> = {};
  for (const r of results) {
    for (const name of r.unmatchedIngredients) {
      allUnmatched[name] = (allUnmatched[name] || 0) + 1;
    }
  }

  if (Object.keys(allUnmatched).length > 0) {
    lines.push('## Common Unmatched Ingredients');
    lines.push('');
    const sorted = Object.entries(allUnmatched).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted.slice(0, 20)) {
      lines.push(`- ${name} (${count}x)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
