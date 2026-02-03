/**
 * Calculate adherence score (0-100) based on how close actuals are to targets.
 * Uses weighted macro scoring: 35% calories, 30% protein, 20% carbs, 15% fat.
 *
 * Scoring logic:
 * - Under target: linear 0-100 (e.g., 50% consumed = 50 score)
 * - Over target: penalized with 2x multiplier (e.g., 150% consumed = 0 score for that macro)
 * - Final score is weighted average clamped to [0, 100]
 */
export function calculateAdherenceScore(dailyLog: {
  actualKcal: number
  actualProteinG: number
  actualCarbsG: number
  actualFatG: number
  targetKcal: number | null
  targetProteinG: number | null
  targetCarbsG: number | null
  targetFatG: number | null
}): number {
  const targets = {
    kcal: dailyLog.targetKcal || 2000,
    protein: dailyLog.targetProteinG || 150,
    carbs: dailyLog.targetCarbsG || 200,
    fat: dailyLog.targetFatG || 65,
  }

  function macroScore(actual: number, target: number): number {
    if (target === 0) return 100
    const ratio = actual / target
    if (ratio <= 1) {
      // Under target: score from 0-100 based on how close
      return Math.round(ratio * 100)
    } else {
      // Over target: penalize going over
      const overBy = ratio - 1
      return Math.max(0, Math.round(100 - overBy * 200))
    }
  }

  const kcalScore = macroScore(dailyLog.actualKcal, targets.kcal)
  const proteinScore = macroScore(dailyLog.actualProteinG, targets.protein)
  const carbsScore = macroScore(dailyLog.actualCarbsG, targets.carbs)
  const fatScore = macroScore(dailyLog.actualFatG, targets.fat)

  // Weighted average: calories and protein matter more
  const score = Math.round(kcalScore * 0.35 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.15)
  return Math.min(100, Math.max(0, score))
}
