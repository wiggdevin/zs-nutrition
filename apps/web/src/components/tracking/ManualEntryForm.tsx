'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast-store'

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface ManualEntryFormProps {
  onSuccess?: (meal: { id: string; mealName: string; kcal: number; proteinG: number; carbsG: number; fatG: number }) => void
}

export default function ManualEntryForm({ onSuccess }: ManualEntryFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('')
  const [loggedDate, setLoggedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastSubmitPayloadRef = useRef<{ foodName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: MealSlot; loggedDate?: string } | null>(null)
  const lastSubmissionTimestampRef = useRef<number>(0)

  // On mount / back-navigation, check if we just submitted (prevent back-resubmit)
  useEffect(() => {
    const state = window.history.state
    if (state && state.manualEntrySubmitted) {
      setSuccessMessage('This entry was already logged. Use the form to add a new entry.')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }, [])

  const resetForm = () => {
    setFoodName('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setMealSlot('')
    setLoggedDate(new Date().toISOString().split('T')[0]) // Reset to today
    setError(null)
    setFieldErrors({})
  }

  const submitEntry = useCallback(async (payload: { foodName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot?: MealSlot; loggedDate?: string }) => {
    setIsSubmitting(true)
    setError(null)
    setIsNetworkError(false)
    setSuccessMessage(null)
    lastSubmitPayloadRef.current = payload

    try {
      const res = await fetch('/api/tracking/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          loggedDate: payload.loggedDate || new Date().toISOString().split('T')[0]
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to log entry')
        setIsNetworkError(false)
        toast.error(data.error || 'Failed to log entry')
        return
      }

      setSuccessMessage(`Logged "${data.trackedMeal.mealName}" (${data.trackedMeal.kcal} kcal)`)
      lastSubmitPayloadRef.current = null
      lastSubmissionTimestampRef.current = Date.now()

      // Show success toast
      toast.success(`${data.trackedMeal.mealName} logged successfully`)

      // Mark history state to prevent back-resubmit
      try {
        window.history.replaceState(
          { ...window.history.state, manualEntrySubmitted: true },
          ''
        )
      } catch { /* ignore */ }
      if (onSuccess) {
        onSuccess(data.trackedMeal)
      }
      resetForm()

      // Auto-hide success message after 3s
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      setError('Unable to connect. Please check your internet connection and try again.')
      setIsNetworkError(true)
      toast.error('Unable to connect. Please check your internet connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [onSuccess])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    // Prevent rapid duplicate submissions (within 3 seconds)
    const now = Date.now()
    if (now - lastSubmissionTimestampRef.current < 3000) {
      setError('Entry was just logged. Please wait a moment before submitting again.')
      return
    }

    // Client-side validation (field-level)
    const newFieldErrors: Record<string, string> = {}
    if (!foodName.trim()) {
      newFieldErrors.foodName = 'Food name is required'
    }
    if (!calories || isNaN(Number(calories)) || Number(calories) < 0) {
      newFieldErrors.calories = 'Please enter a valid calorie amount (0 or more)'
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }
    setFieldErrors({})

    await submitEntry({
      foodName: foodName.trim(),
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      mealSlot: mealSlot || undefined,
      loggedDate: loggedDate,
    })
  }

  const handleRetry = async () => {
    if (lastSubmitPayloadRef.current) {
      await submitEntry(lastSubmitPayloadRef.current)
    }
  }

  return (
    <div className="w-full">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-3 px-4 bg-card border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          data-testid="manual-entry-toggle"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Food Manually
        </button>
      )}

      {/* Manual Entry Form */}
      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-5"
          data-testid="manual-entry-form"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Manual Entry</h3>
            <button
              type="button"
              onClick={() => { setIsOpen(false); resetForm() }}
              aria-label="Close manual entry form"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Food Name */}
          <div className="mb-4">
            <label htmlFor="manual-food-name" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Food Name *
            </label>
            <input
              id="manual-food-name"
              type="text"
              value={foodName}
              onChange={(e) => {
                setFoodName(e.target.value)
                if (fieldErrors.foodName && e.target.value.trim()) {
                  setFieldErrors((prev) => { const next = { ...prev }; delete next.foodName; return next })
                }
              }}
              placeholder="e.g. Grilled Chicken Breast"
              aria-invalid={!!fieldErrors.foodName}
              aria-describedby={fieldErrors.foodName ? "manual-food-name-error" : undefined}
              className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors ${
                fieldErrors.foodName
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
              data-testid="manual-food-name"
              autoComplete="off"
            />
            {fieldErrors.foodName && (
              <p id="manual-food-name-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
                {fieldErrors.foodName}
              </p>
            )}
          </div>

          {/* Meal Slot Selector */}
          <div className="mb-4">
            <label htmlFor="manual-meal-slot" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Meal Slot <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </label>
            <select
              id="manual-meal-slot"
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value as MealSlot | '')}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="manual-meal-slot"
            >
              <option value="">No meal slot</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          {/* Date Selector */}
          <div className="mb-4">
            <label htmlFor="manual-date" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              id="manual-date"
              type="date"
              value={loggedDate}
              onChange={(e) => setLoggedDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="manual-date"
            />
          </div>

          {/* Macro Fields */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="manual-calories" className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1.5">
                Calories *
              </label>
              <input
                id="manual-calories"
                type="number"
                min="0"
                step="1"
                value={calories}
                onChange={(e) => {
                  setCalories(e.target.value)
                  if (fieldErrors.calories && e.target.value && !isNaN(Number(e.target.value)) && Number(e.target.value) >= 0) {
                    setFieldErrors((prev) => { const next = { ...prev }; delete next.calories; return next })
                  }
                }}
                placeholder="0"
                aria-invalid={!!fieldErrors.calories}
                aria-describedby={fieldErrors.calories ? "manual-calories-error" : undefined}
                className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors ${
                  fieldErrors.calories
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
                data-testid="manual-calories"
              />
              {fieldErrors.calories && (
                <p id="manual-calories-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
                  {fieldErrors.calories}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="manual-protein" className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5">
                Protein (g)
              </label>
              <input
                id="manual-protein"
                type="number"
                min="0"
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                data-testid="manual-protein"
              />
            </div>
            <div>
              <label htmlFor="manual-carbs" className="block text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5">
                Carbs (g)
              </label>
              <input
                id="manual-carbs"
                type="number"
                min="0"
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
                data-testid="manual-carbs"
              />
            </div>
            <div>
              <label htmlFor="manual-fat" className="block text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1.5">
                Fat (g)
              </label>
              <input
                id="manual-fat"
                type="number"
                min="0"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
                data-testid="manual-fat"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm" data-testid="manual-entry-error" role="alert" aria-live="assertive">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-300">{error}</p>
                  {isNetworkError && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSubmitting}
                      className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="manual-entry-retry"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2" data-testid="manual-entry-success" role="status" aria-live="polite">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="manual-entry-submit"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Log Entry
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
