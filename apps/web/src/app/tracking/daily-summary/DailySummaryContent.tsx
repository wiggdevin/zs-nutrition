'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

function PortionAdjuster({
  mealId,
  currentPortion,
  onAdjusted,
}: {
  mealId: string
  currentPortion: number
  onAdjusted: () => void
}) {
  const [portion, setPortion] = useState(currentPortion)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (portion === currentPortion) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/tracking/adjust-portion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedMealId: mealId, newPortion: portion }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust portion')
      }

      setSuccess(true)
      setIsEditing(false)
      // Refetch data to show updated values
      onAdjusted()
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setPortion(currentPortion)
    setIsEditing(false)
    setError(null)
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-xs text-[#a1a1aa] hover:text-orange-400 transition-colors border border-[#2a2a2a] hover:border-orange-500/50 rounded px-2 py-0.5"
        data-testid="adjust-portion-btn"
        title="Adjust portion"
      >
        {currentPortion}x
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1" data-testid="portion-editor">
      <button
        onClick={() => setPortion(Math.max(0.1, Math.round((portion - 0.25) * 100) / 100))}
        className="w-6 h-6 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold"
        disabled={isSaving || portion <= 0.1}
        data-testid="portion-decrease"
      >
        -
      </button>
      <input
        type="number"
        value={portion}
        onChange={(e) => {
          const val = parseFloat(e.target.value)
          if (!isNaN(val) && val > 0 && val <= 10) {
            setPortion(Math.round(val * 100) / 100)
          }
        }}
        className="w-14 text-center bg-zinc-800 border border-zinc-600 rounded text-xs py-0.5 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        step="0.25"
        min="0.1"
        max="10"
        disabled={isSaving}
        data-testid="portion-input"
      />
      <button
        onClick={() => setPortion(Math.min(10, Math.round((portion + 0.25) * 100) / 100))}
        className="w-6 h-6 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold"
        disabled={isSaving || portion >= 10}
        data-testid="portion-increase"
      >
        +
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving || portion === currentPortion}
        className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-[#0a0a0a] px-2 py-0.5 rounded font-medium"
        data-testid="portion-save"
      >
        {isSaving ? '...' : 'Save'}
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="text-xs text-[#a1a1aa] hover:text-white px-1"
        data-testid="portion-cancel"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
      {success && <span className="text-xs text-green-400">Updated!</span>}
    </div>
  )
}

function DeleteMealButton({
  mealId,
  mealName,
  onDeleted,
}: {
  mealId: string
  mealName: string
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteMutation = trpc.meal.deleteTrackedMeal.useMutation({
    onSuccess: () => {
      onDeleted()
    },
    onError: (err) => {
      setError(err.message)
      setIsDeleting(false)
    },
  })

  const handleDelete = () => {
    setIsDeleting(true)
    setError(null)
    deleteMutation.mutate({ trackedMealId: mealId })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 mt-1" data-testid="delete-confirm">
        <span className="text-xs text-red-400">Delete &ldquo;{mealName}&rdquo;?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
          data-testid="delete-confirm-yes"
        >
          {isDeleting ? '...' : 'Yes'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={isDeleting}
          className="text-xs text-[#a1a1aa] hover:text-white px-1"
          data-testid="delete-confirm-no"
        >
          No
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-[#a1a1aa] hover:text-red-400 transition-colors p-1"
      data-testid="delete-meal-btn"
      title="Delete meal"
    >
      ✕
    </button>
  )
}

export function DailySummaryContent() {
  // State for currently selected date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format
    return new Date().toISOString().split('T')[0]
  })

  // Query with the selected date
  const { data, isLoading, error, refetch } = trpc.tracking.getDailySummary.useQuery(
    { date: selectedDate }
  )

  // Helper to format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Navigate to previous/next day
  const navigateDate = (days: number) => {
    const currentDate = new Date(selectedDate)
    currentDate.setDate(currentDate.getDate() + days)
    const newDateStr = currentDate.toISOString().split('T')[0]
    setSelectedDate(newDateStr)
  }

  // Group meals by slot
  const groupMealsBySlot = (meals: typeof data.trackedMeals) => {
    const groups: Record<string, typeof meals> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: []
    }

    meals.forEach(meal => {
      const slot = meal.mealSlot || 'other'
      if (groups[slot] !== undefined) {
        groups[slot].push(meal)
      } else {
        groups.other.push(meal)
      }
    })

    return groups
  }

  if (isLoading) {
    return <div className="text-[#a1a1aa] animate-pulse">Loading daily summary...</div>
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-lg p-4" data-testid="network-error-state">
        <div className="flex flex-col items-center text-center space-y-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-300">Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            data-testid="retry-button"
            className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] text-sm font-bold uppercase tracking-wide rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase mb-3">Date</h2>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-[#fafafa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="prev-day-btn"
            title="Previous day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <p className="text-lg font-medium" data-testid="summary-date">{formatDateDisplay(selectedDate)}</p>
            <p className="text-sm text-[#a1a1aa]" data-testid="meal-count">{data.mealCount} meal{data.mealCount !== 1 ? 's' : ''} logged</p>
          </div>
          <button
            onClick={() => navigateDate(1)}
            disabled={new Date(selectedDate) >= new Date(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-[#fafafa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="next-day-btn"
            title="Next day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase mb-3">Daily Log</h2>
        {data.dailyLog ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs text-[#a1a1aa] uppercase">Targets</h3>
                <div className="mt-1 space-y-1">
                  <p data-testid="target-kcal">{data.dailyLog.targetKcal} kcal target</p>
                  <p data-testid="target-protein">{data.dailyLog.targetProteinG}g protein target</p>
                  <p data-testid="target-carbs">{data.dailyLog.targetCarbsG}g carbs target</p>
                  <p data-testid="target-fat">{data.dailyLog.targetFatG}g fat target</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs text-[#a1a1aa] uppercase">Consumed</h3>
                <div className="mt-1 space-y-1">
                  <p data-testid="actual-kcal">{data.dailyLog.actualKcal} kcal consumed</p>
                  <p data-testid="actual-protein">{data.dailyLog.actualProteinG}g protein consumed</p>
                  <p data-testid="actual-carbs">{data.dailyLog.actualCarbsG}g carbs consumed</p>
                  <p data-testid="actual-fat">{data.dailyLog.actualFatG}g fat consumed</p>
                </div>
              </div>
            </div>
            {data.dailyLog.adherenceScore !== null && (
              <div className="pt-2 border-t border-zinc-700">
                <p className="text-sm" data-testid="adherence-score">
                  Adherence Score: <span className="text-orange-400 font-bold">{data.dailyLog.adherenceScore}%</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[#a1a1aa]" data-testid="no-daily-log">No daily log yet - log some meals first!</p>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase mb-2">Calculated Totals</h2>
        <div className="flex gap-3 flex-wrap">
          <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm" data-testid="total-kcal">
            {data.totals.kcal} kcal
          </span>
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm" data-testid="total-protein">
            P {data.totals.proteinG}g
          </span>
          <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm" data-testid="total-carbs">
            C {data.totals.carbsG}g
          </span>
          <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm" data-testid="total-fat">
            F {data.totals.fatG}g
          </span>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase mb-3">
          Tracked Meals ({data.trackedMeals.length})
        </h2>
        {data.trackedMeals.length > 0 ? (
          <div className="space-y-4">
            {(() => {
              const grouped = groupMealsBySlot(data.trackedMeals)
              const slotOrder = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
              const slotLabels: Record<string, string> = {
                breakfast: 'Breakfast',
                lunch: 'Lunch',
                dinner: 'Dinner',
                snack: 'Snack',
                other: 'Other'
              }

              return slotOrder.map(slot => {
                const mealsInSlot = grouped[slot]
                if (mealsInSlot.length === 0) return null

                return (
                  <div key={slot} data-testid={`meal-slot-${slot}`}>
                    <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">
                      {slotLabels[slot]} ({mealsInSlot.length})
                    </h3>
                    <div className="space-y-2">
                      {mealsInSlot.map((meal) => (
                        <div
                          key={meal.id}
                          className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3"
                          data-testid="tracked-meal-entry"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium" data-testid="meal-name">{meal.mealName}</p>
                              <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                                <span>{meal.source}</span>
                                <span>{'\u00B7'}</span>
                                <PortionAdjuster
                                  mealId={meal.id}
                                  currentPortion={meal.portion}
                                  onAdjusted={() => refetch()}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-orange-400 font-semibold text-sm" data-testid="meal-kcal">{meal.kcal} kcal</span>
                              <DeleteMealButton
                                mealId={meal.id}
                                mealName={meal.mealName}
                                onDeleted={() => refetch()}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs text-blue-400">P {meal.proteinG}g</span>
                            <span className="text-xs text-amber-400">C {meal.carbsG}g</span>
                            <span className="text-xs text-red-400">F {meal.fatG}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        ) : (
          <p className="text-[#a1a1aa]" data-testid="no-meals">No meals tracked on this date.</p>
        )}
      </div>
    </div>
  )
}
