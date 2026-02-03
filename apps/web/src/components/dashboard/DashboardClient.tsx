'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast-store'
import { useTrackingStore, MacroTargets, MacroCurrent } from '@/lib/stores/useTrackingStore'
import { shallow } from 'zustand/shallow'

const defaultTargets: MacroTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
}

const defaultCurrent: MacroCurrent = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
}

/* ── Types ── */
interface PlanMeal {
  slot: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  prepTime: string
  dayNumber: number
  confidenceLevel: string
}

interface TrackedMealEntry {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  portion: number
  source: 'plan_meal' | 'fatsecret_search' | 'quick_add' | 'manual'
  mealSlot: string | null
  confidenceScore?: number | null
  createdAt: string
}

interface DashboardData {
  planId: string | null
  todayPlanMeals: PlanMeal[]
  trackedMeals: TrackedMealEntry[]
  macros: {
    calories: { current: number; target: number }
    protein: { current: number; target: number }
    carbs: { current: number; target: number }
    fat: { current: number; target: number }
  }
  adherenceScore: number
  weeklyAverageAdherence: number | null
  isTrainingDay: boolean
  trainingDays: string[]
  trainingBonusKcal: number
  baseGoalKcal: number
}

/* ── Macro Ring SVG Component ── */
function MacroRing({
  label,
  current,
  target,
  unit,
  color,
  size = 120,
}: {
  label: string
  current: number
  target: number
  unit: string
  color: string
  size?: number
}) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(current / (target || 1), 1)
  const targetDashOffset = circumference * (1 - progress)
  const percentage = Math.round(progress * 100)

  // Animate from 0 on mount, then animate to new values on updates
  const [dashOffset, setDashOffset] = useState(circumference) // Start empty (full offset)
  const [animatedCurrent, setAnimatedCurrent] = useState(0)

  useEffect(() => {
    // Animate to new values with smooth timing
    const timer = setTimeout(() => {
      setDashOffset(targetDashOffset)
      setAnimatedCurrent(current)
    }, 50) // Small delay to ensure transition triggers

    return () => clearTimeout(timer)
  }, [current, targetDashOffset])

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="progressbar"
      aria-label={`${label}`}
      aria-valuenow={current}
      aria-valuemax={target}
      aria-valuetext={`${label}: ${current} of ${target} ${unit}, ${percentage}% complete`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500 ease-out"
            style={{
              transitionProperty: 'stroke-dashoffset',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono transition-all duration-500 ease-out" style={{ color }}>
            {animatedCurrent}
          </span>
          <span className="text-[10px] text-[#a1a1aa] font-mono">
            / {target}
            {unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
        {label}
      </span>
    </div>
  )
}

/* ── Quick Action Button Component ── */
function QuickAction({
  icon,
  label,
  href,
}: {
  icon: string
  label: string
  href: string
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center gap-3 px-5 py-3 card-elevation border border-[#2a2a2a] rounded-xl hover:border-[#f97316]/30 transition-all duration-200 group"
    >
      <span className="text-xl" aria-hidden="true">{icon}</span>
      <span className="text-sm font-semibold uppercase tracking-wide text-[#a1a1aa] group-hover:text-[#fafafa] transition-colors">
        {label}
      </span>
    </Link>
  )
}

/* ── Meal Card Component with Log Button ── */
function PlanMealCard({
  name,
  mealSlot,
  calories,
  protein,
  carbs,
  fat,
  prepTime,
  isLogged,
  isLogging,
  onLog,
}: {
  name: string
  mealSlot: string
  calories: number
  protein: number
  carbs: number
  fat: number
  prepTime: string
  isLogged: boolean
  isLogging: boolean
  onLog: () => void
}) {
  return (
    <div className="p-4 card-elevation border border-[#2a2a2a] rounded-xl hover:border-[#3a3a3a] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-1">
            {mealSlot}
          </p>
          <p className="text-sm font-semibold text-[#fafafa] truncate">{name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#a1a1aa] hidden sm:inline">{prepTime}</span>
          {isLogged ? (
            <span className="px-3 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wide bg-[#22c55e]/20 text-[#22c55e] rounded-lg flex items-center gap-1">
              ✓ Logged
            </span>
          ) : (
            <button
              onClick={onLog}
              disabled={isLogging}
              data-testid={`log-btn-${mealSlot.toLowerCase()}`}
              aria-label={`Log ${mealSlot}`}
              className="px-4 py-2 min-h-[44px] min-w-[44px] text-xs font-bold uppercase tracking-wide bg-[#f97316] hover:bg-[#ea580c] disabled:bg-[#f97316]/50 disabled:cursor-not-allowed text-[#0a0a0a] rounded-lg transition-colors"
            >
              {isLogging ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging</span>
                </span>
              ) : 'Log'}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] font-mono">
          {calories} kcal
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-mono">
          P {protein}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] font-mono">
          C {carbs}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eab308]/10 text-[#eab308] font-mono">
          F {fat}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#a1a1aa]/10 text-[#a1a1aa] font-mono sm:hidden">
          {prepTime}
        </span>
      </div>
    </div>
  )
}

/* ── Log Confirmation Modal ── */
function LogConfirmModal({
  meal,
  onConfirm,
  onCancel,
  isLogging,
}: {
  meal: PlanMeal
  onConfirm: (portion: number) => void
  onCancel: () => void
  isLogging: boolean
}) {
  const [portion, setPortion] = useState(1.0)

  const adjustedCalories = Math.round(meal.calories * portion)
  const adjustedProtein = Math.round(meal.protein * portion * 10) / 10
  const adjustedCarbs = Math.round(meal.carbs * portion * 10) / 10
  const adjustedFat = Math.round(meal.fat * portion * 10) / 10

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-meal-title"
    >
      <div
        data-testid="log-confirm-modal"
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        role="document"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-1">
          /// Log Meal
        </p>
        <h3 id="log-meal-title" className="text-lg font-bold text-[#fafafa] mb-4">{meal.name}</h3>

        {/* Portion Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#a1a1aa]">Portion</label>
            <span
              data-testid="portion-value"
              className="text-sm font-bold text-[#f97316]"
            >
              {portion.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            value={portion}
            onChange={(e) => setPortion(parseFloat(e.target.value))}
            data-testid="portion-slider"
            className="w-full h-2 bg-[#2a2a2a] rounded-full appearance-none cursor-pointer accent-[#f97316]"
          />
          <div className="flex justify-between text-[10px] text-[#a1a1aa] mt-1">
            <span>0.25×</span>
            <span>1×</span>
            <span>2×</span>
            <span>3×</span>
          </div>
        </div>

        {/* Auto-filled Nutrition Preview */}
        <div
          data-testid="nutrition-preview"
          className="card-elevation border border-[#2a2a2a] rounded-xl p-4 mb-6"
        >
          <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-3">
            Nutrition
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f97316]" />
              <span className="text-sm text-[#a1a1aa]">Calories</span>
              <span data-testid="preview-calories" className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedCalories} kcal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span className="text-sm text-[#a1a1aa]">Protein</span>
              <span data-testid="preview-protein" className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedProtein}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="text-sm text-[#a1a1aa]">Carbs</span>
              <span data-testid="preview-carbs" className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedCarbs}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#eab308]" />
              <span className="text-sm text-[#a1a1aa]">Fat</span>
              <span data-testid="preview-fat" className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedFat}g
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLogging}
            className="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide border border-[#2a2a2a] text-[#a1a1aa] hover:bg-[#252525] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(portion)}
            disabled={isLogging}
            data-testid="confirm-log-btn"
            aria-label={`Confirm logging ${meal.name}`}
            className="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide bg-[#f97316] hover:bg-[#ea580c] disabled:bg-[#f97316]/50 disabled:cursor-not-allowed text-[#0a0a0a] rounded-xl transition-colors"
          >
            {isLogging ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Logging...</span>
              </span>
            ) : 'Confirm Log'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Portion Adjustment Modal ── */
function PortionAdjustModal({
  mealName,
  currentPortion,
  calories,
  protein,
  carbs,
  fat,
  onConfirm,
  onCancel,
  isAdjusting,
}: {
  mealName: string
  currentPortion: number
  calories: number
  protein: number
  carbs: number
  fat: number
  onConfirm: (newPortion: number) => void
  onCancel: () => void
  isAdjusting: boolean
}) {
  const [portion, setPortion] = useState(currentPortion)

  // Calculate base nutrition (per 1.0 portion)
  const baseKcal = Math.round(calories / currentPortion)
  const baseProtein = Math.round((protein / currentPortion) * 10) / 10
  const baseCarbs = Math.round((carbs / currentPortion) * 10) / 10
  const baseFat = Math.round((fat / currentPortion) * 10) / 10

  // Calculate adjusted nutrition
  const adjustedKcal = Math.round(baseKcal * portion)
  const adjustedProtein = Math.round(baseProtein * portion * 10) / 10
  const adjustedCarbs = Math.round(baseCarbs * portion * 10) / 10
  const adjustedFat = Math.round(baseFat * portion * 10) / 10

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-portion-title"
    >
      <div
        data-testid="adjust-portion-modal"
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        role="document"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-1">
          /// Adjust Portion
        </p>
        <h3 id="adjust-portion-title" className="text-lg font-bold text-[#fafafa] mb-4">{mealName}</h3>

        {/* Portion Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#a1a1aa]">Portion</label>
            <span
              data-testid="adjust-portion-value"
              className="text-sm font-bold text-[#f97316]"
            >
              {portion}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={portion}
            onChange={(e) => setPortion(parseFloat(e.target.value))}
            className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
            data-testid="adjust-portion-slider"
          />
          <div className="flex justify-between text-xs text-[#666] mt-1">
            <span>0.5x</span>
            <span>1x</span>
            <span>2x</span>
            <span>3x</span>
          </div>
        </div>

        {/* Nutrition Preview */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 mb-6">
          <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-3">
            Adjusted Nutrition
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f97316]" />
              <span className="text-xs text-[#a1a1aa]">Calories</span>
              <span className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedKcal} kcal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span className="text-xs text-[#a1a1aa]">Protein</span>
              <span className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedProtein}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-[#a1a1aa]">Carbs</span>
              <span className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedCarbs}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#eab308]" />
              <span className="text-xs text-[#a1a1aa]">Fat</span>
              <span className="text-sm font-bold text-[#fafafa] ml-auto">
                {adjustedFat}g
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isAdjusting}
            className="flex-1 px-4 py-3 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed text-[#fafafa] font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(portion)}
            disabled={isAdjusting}
            className="flex-1 px-4 py-3 bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0a] font-bold rounded-lg transition-colors"
            data-testid="adjust-portion-confirm"
          >
            {isAdjusting ? 'Adjusting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Log Entry Component ── */
function LogEntry({
  id,
  name,
  calories,
  protein,
  carbs,
  fat,
  portion,
  source,
  confidenceScore,
  time,
  onAdjust,
  isAdjusting,
}: {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  portion: number
  source: 'plan_meal' | 'fatsecret_search' | 'quick_add' | 'manual'
  confidenceScore?: number | null
  time: string
  onAdjust: (id: string, newPortion: number) => void
  isAdjusting: boolean
}) {
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  // Determine confidence badge based on source and confidenceScore
  // - FatSecret foods are always "Verified" (green)
  // - Plan meals: confidenceScore >= 1.0 = "Verified", < 1.0 = "AI-Estimated"
  // - Quick Add and Manual use their original badges
  const getConfidenceBadge = () => {
    if (source === 'fatsecret_search') {
      return { label: 'Verified', color: 'bg-[#22c55e]/10 text-[#22c55e]' }
    }
    if (source === 'plan_meal') {
      // confidenceScore >= 1.0 means verified, < 1.0 means ai_estimated
      if (confidenceScore !== undefined && confidenceScore >= 1.0) {
        return { label: 'Verified', color: 'bg-[#22c55e]/10 text-[#22c55e]' }
      }
      return { label: 'AI-Estimated', color: 'bg-[#f59e0b]/10 text-[#f59e0b]' }
    }
    if (source === 'quick_add') {
      return { label: 'Quick Add', color: 'bg-[#f59e0b]/10 text-[#f59e0b]' }
    }
    // manual
    return { label: 'Manual', color: 'bg-[#a1a1aa]/10 text-[#a1a1aa]' }
  }

  const badge = getConfidenceBadge()

  const handleConfirmAdjust = (newPortion: number) => {
    onAdjust(id, newPortion)
    setShowAdjustModal(false)
  }

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-[#fafafa] truncate">{name}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${badge.color}`}
            >
              {badge.label}
            </span>
            {portion !== 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[#f97316]/10 text-[#f97316]">
                {portion}x
              </span>
            )}
          </div>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {time} · {calories} kcal · {protein}g protein
          </p>
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          disabled={isAdjusting}
          className="px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f97316] border border-[#2a2a2a] hover:border-[#f97316] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`adjust-btn-${id}`}
        >
          Adjust
        </button>
      </div>

      {showAdjustModal && (
        <PortionAdjustModal
          mealName={name}
          currentPortion={portion}
          calories={calories}
          protein={protein}
          carbs={carbs}
          fat={fat}
          onConfirm={handleConfirmAdjust}
          onCancel={() => setShowAdjustModal(false)}
          isAdjusting={isAdjusting}
        />
      )}
    </>
  )
}

/* ── Skeleton Pulse Block ── */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-[#1a1a1a] rounded skeleton-shimmer ${className ?? ''}`} />
}

/* ── Macro Ring Skeleton ── */
function MacroRingSkeleton({ size = 120 }: { size?: number }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex flex-col items-center gap-2" data-testid="macro-ring-skeleton">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.7}
            className="skeleton-shimmer"
            style={{
              background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <SkeletonBlock className="h-5 w-10" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-16" />
    </div>
  )
}

/* ── Meal Card Skeleton ── */
function MealCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 card-elevation border border-[#2a2a2a] rounded-xl" data-testid="meal-card-skeleton">
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-4 w-40" />
        <div className="flex gap-3 mt-2">
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <SkeletonBlock className="h-4 w-10" />
        <SkeletonBlock className="h-8 w-14 rounded-lg" />
      </div>
    </div>
  )
}

/* ── Log Entry Skeleton ── */
function LogEntrySkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-b-0" data-testid="log-entry-skeleton">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-14 rounded-full" />
        </div>
        <SkeletonBlock className="h-3 w-44" />
      </div>
    </div>
  )
}

/* ── Loading Skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]" data-testid="dashboard-skeleton">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#f97316] text-2xl font-heading">///</span>
            <SkeletonBlock className="h-7 w-32" />
          </div>
          <SkeletonBlock className="h-10 w-10 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        {/* Page Title Skeleton */}
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>

        {/* ═══ MACRO RINGS SKELETON ═══ */}
        <section
          data-testid="macro-rings-skeleton"
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <SkeletonBlock className="h-3 w-24" />
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-6 w-32 rounded-full" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 md:gap-8 justify-items-center">
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
          </div>
          <div className="mt-6 flex justify-center">
            <SkeletonBlock className="h-4 w-52" />
          </div>
        </section>

        {/* ═══ ADHERENCE SCORE SKELETON ═══ */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
          <SkeletonBlock className="h-3 w-32 mb-4" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-12 w-16" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <div className="h-12 w-px bg-[#2a2a2a]" />
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-8 w-12" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <div className="h-12 w-px bg-[#2a2a2a]" />
            <div className="flex-1 space-y-1">
              <SkeletonBlock className="h-3 w-full rounded-full" />
              <SkeletonBlock className="h-2 w-24" />
            </div>
          </div>
        </section>

        {/* Two-column layout for Plan + Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ═══ TODAY'S PLAN SKELETON ═══ */}
          <section
            data-testid="todays-plan-skeleton"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <div className="space-y-3">
              <MealCardSkeleton />
              <MealCardSkeleton />
              <MealCardSkeleton />
            </div>
          </section>

          {/* ═══ TODAY'S LOG SKELETON ═══ */}
          <section
            data-testid="todays-log-skeleton"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <div>
              <LogEntrySkeleton />
              <LogEntrySkeleton />
              <LogEntrySkeleton />
            </div>
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex justify-center">
              <SkeletonBlock className="h-3 w-64" />
            </div>
          </section>
        </div>

        {/* ═══ QUICK ACTIONS SKELETON ═══ */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
          <SkeletonBlock className="h-3 w-28 mb-4" />
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-12 w-36 rounded-xl" />
            <SkeletonBlock className="h-12 w-32 rounded-xl" />
            <SkeletonBlock className="h-12 w-28 rounded-xl" />
          </div>
        </section>
      </main>
    </div>
  )
}

/* ── Main Dashboard Client Component ── */
export default function DashboardClient() {
  // Zustand store for tracking state (persists across navigation)
  // Use shallow comparison to avoid unnecessary re-renders
  const trackedMeals = useTrackingStore((state) => state.trackedMeals)
  const targets = useTrackingStore((state) => state.targets)
  const current = useTrackingStore((state) => state.current)
  const adherenceScore = useTrackingStore((state) => state.adherenceScore)
  const weeklyAverageAdherence = useTrackingStore((state) => state.weeklyAverageAdherence)
  const planId = useTrackingStore((state) => state.planId)
  const lastFetch = useTrackingStore((state) => state.lastFetch)

  // Actions - separate calls to avoid hook dependency issues
  const setTrackedMeals = useTrackingStore((state) => state.setTrackedMeals)
  const setCurrent = useTrackingStore((state) => state.setCurrent)
  const setTargets = useTrackingStore((state) => state.setTargets)
  const setAdherenceScore = useTrackingStore((state) => state.setAdherenceScore)
  const setWeeklyAverageAdherence = useTrackingStore((state) => state.setWeeklyAverageAdherence)
  const setPlanId = useTrackingStore((state) => state.setPlanId)
  const addTrackedMeal = useTrackingStore((state) => state.addTrackedMeal)
  const updateTrackedMealPortion = useTrackingStore((state) => state.updateTrackedMealPortion)
  const setLastFetch = useTrackingStore((state) => state.setLastFetch)

  const [todayPlanMeals, setTodayPlanMeals] = useState<PlanMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingSlot, setLoggingSlot] = useState<string | null>(null)
  const [adjustingMealId, setAdjustingMealId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mealToLog, setMealToLog] = useState<PlanMeal | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isTrainingDay, setIsTrainingDay] = useState(false)
  const [trainingBonusKcal, setTrainingBonusKcal] = useState(0)
  const [baseGoalKcal, setBaseGoalKcal] = useState(0)
  const router = useRouter()

  // Track the current fetch request so we can abort stale ones
  const abortControllerRef = useRef<AbortController | null>(null)
  // Track a fetch generation counter to ignore late responses
  const fetchGenerationRef = useRef(0)

  const fetchData = useCallback(async (forceRefetch = false) => {
    // Check if we have fresh data in Zustand store (less than 1 minute old)
    const now = Date.now()
    const STORE_FRESHNESS_MS = 60 * 1000 // 1 minute

    if (!forceRefetch && lastFetch && (now - lastFetch < STORE_FRESHNESS_MS)) {
      // Use Zustand store data - no need to refetch
      setLoading(false)
      return
    }

    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    const generation = ++fetchGenerationRef.current

    try {
      // Get client-side day of week (respects user's timezone)
      const clientDayOfWeek = new Date().getDay()
      const res = await fetch(`/api/dashboard/data?dayOfWeek=${clientDayOfWeek}`, { signal: controller.signal })
      // If a newer fetch was started, discard this stale response
      if (generation !== fetchGenerationRef.current) return
      if (!res.ok) {
        // Don't expose raw server error details to user
        if (res.status >= 500) {
          throw new Error('Something went wrong on our end. Please try again later.')
        }
        throw new Error('Unable to load your dashboard. Please try again.')
      }
      const json = await res.json()

      // Double-check generation again after async json parsing
      if (generation !== fetchGenerationRef.current) return

      // If user has no profile and hasn't completed onboarding, redirect to onboarding
      if (!json.hasProfile && !json.hasCompletedOnboarding) {
        setNeedsOnboarding(true)
        router.push('/onboarding')
        return
      }

      // Update Zustand store with server data
      setTargets(json.macros.calories ? {
        calories: json.macros.calories.target,
        protein: json.macros.protein.target,
        carbs: json.macros.carbs.target,
        fat: json.macros.fat.target,
      } : defaultTargets)

      setCurrent(json.macros.calories ? {
        calories: json.macros.calories.current,
        protein: json.macros.protein.current,
        carbs: json.macros.carbs.current,
        fat: json.macros.fat.current,
      } : defaultCurrent)

      setTrackedMeals(json.trackedMeals || [])
      setAdherenceScore(json.adherenceScore ?? 0)
      setWeeklyAverageAdherence(json.weeklyAverageAdherence ?? null)
      setPlanId(json.planId || null)
      setLastFetch(now)

      // Set local state for plan meals
      setTodayPlanMeals(json.todayPlanMeals || [])
      setIsTrainingDay(json.isTrainingDay ?? false)
      setTrainingBonusKcal(json.trainingBonusKcal ?? 0)
      setBaseGoalKcal(json.baseGoalKcal ?? json.macros?.calories?.target ?? 2000)

      setError(null)
    } catch (err) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return
      // If this is a stale generation, ignore
      if (generation !== fetchGenerationRef.current) return
      // For network errors, show a connection-friendly message
      const message = err instanceof Error ? err.message : 'Something went wrong'
      const isFriendly = message.includes('Something went wrong') || message.includes('Unable to') || message.includes('Please try')
      setError(isFriendly ? message : 'Something went wrong. Please try again later.')
    } finally {
      // Only update loading state if this is still the current generation
      if (generation === fetchGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [router, lastFetch, setTargets, setCurrent, setTrackedMeals, setAdherenceScore, setWeeklyAverageAdherence, setPlanId, setLastFetch])

  useEffect(() => {
    fetchData()
    // Cleanup: abort any in-flight request when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  // Handle hash scrolling for quick action links
  useEffect(() => {
    // Wait for data to load before scrolling
    if (loading) return

    const hash = window.location.hash.replace('#', '')
    if (hash === 'todays-plan') {
      const element = document.getElementById('todays-plan')
      if (element) {
        // Small delay to ensure render is complete
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  }, [loading])

  const openLogModal = (meal: PlanMeal) => {
    setMealToLog(meal)
  }

  const isLoggingRef = useRef(false)

  const handleLogFromPlan = async (portion: number) => {
    if (!mealToLog) return
    // Synchronous guard prevents double-click from creating duplicate entries
    if (isLoggingRef.current) return
    isLoggingRef.current = true
    setLoggingSlot(mealToLog.slot)
    try {
      const res = await fetch('/api/tracking/log-from-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: useTrackingStore.getState().planId,
          dayNumber: mealToLog.dayNumber,
          slot: mealToLog.slot,
          portion,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to log meal')
      }

      const result = await res.json()

      if (result.success && result.trackedMeal) {
        // Update Zustand store immediately (optimistic update)
        addTrackedMeal({
          id: result.trackedMeal.id,
          name: result.trackedMeal.name,
          calories: result.trackedMeal.calories,
          protein: result.trackedMeal.protein,
          carbs: result.trackedMeal.carbs,
          fat: result.trackedMeal.fat,
          portion: result.trackedMeal.portion || portion,
          source: result.trackedMeal.source || 'plan_meal',
          mealSlot: result.trackedMeal.mealSlot || mealToLog.slot,
          createdAt: result.trackedMeal.createdAt || new Date().toISOString(),
        })

        // Close modal
        setMealToLog(null)

        const mealName = result.trackedMeal.name || mealToLog.name
        toast.success(`${mealName} logged successfully`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      const isFriendly = msg.includes('Something went wrong') || msg.includes('Unable to') || msg.includes('Please try')
      const errorMsg = isFriendly ? msg : 'Something went wrong while logging your meal. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoggingSlot(null)
      isLoggingRef.current = false
    }
  }

  const handleAdjustPortion = async (trackedMealId: string, newPortion: number) => {
    // Synchronous guard prevents double-click
    if (isLoggingRef.current) return
    isLoggingRef.current = true
    setAdjustingMealId(trackedMealId)
    try {
      const res = await fetch('/api/tracking/adjust-portion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedMealId, newPortion }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to adjust portion')
      }

      const result = await res.json()

      if (result.success && result.trackedMeal) {
        // Update the tracked meal in Zustand store
        const updatedMeals = trackedMeals.map((meal) =>
          meal.id === trackedMealId
            ? {
                ...meal,
                calories: result.trackedMeal.kcal,
                protein: result.trackedMeal.proteinG,
                carbs: result.trackedMeal.carbsG,
                fat: result.trackedMeal.fatG,
                portion: result.trackedMeal.portion,
              }
            : meal
        )
        setTrackedMeals(updatedMeals)

        // Update daily totals
        setCurrent({
          calories: result.dailyTotals.actualKcal,
          protein: result.dailyTotals.actualProteinG,
          carbs: result.dailyTotals.actualCarbsG,
          fat: result.dailyTotals.actualFatG,
        })

        toast.success(`Portion adjusted to ${newPortion}x`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      const errorMsg = isFriendly ? msg : 'Something went wrong while adjusting portion. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setAdjustingMealId(null)
      isLoggingRef.current = false
    }
  }

  // Show loading while redirecting to onboarding
  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center" data-testid="onboarding-redirect">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
          <p className="text-sm text-[#a1a1aa] font-mono uppercase tracking-wider">
            Redirecting to onboarding...
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <DashboardSkeleton />

  if (error && trackedMeals.length === 0 && targets.calories === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center" data-testid="network-error-state">
        <div className="text-center space-y-6 max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-[#fafafa] mb-2">Oops! Something went wrong</p>
            <p className="text-sm text-[#a1a1aa]" data-testid="error-message">{error}</p>
          </div>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData(true) }}
            data-testid="retry-button"
            aria-label="Retry loading dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] text-sm font-bold uppercase tracking-wide rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ═══ EMPTY STATE: New user with no meal plans ═══
  const hasNoPlan = !planId && todayPlanMeals.length === 0 && trackedMeals.length === 0

  if (hasNoPlan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Header */}
        <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-heading uppercase tracking-wide text-[#fafafa]">
              <span className="text-[#f97316]">///</span> Dashboard
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">
                  Daily Target
                </span>
                <span className="text-lg font-bold font-mono text-[#f97316]">
                  {targets.calories.toLocaleString()} kcal
                </span>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#f97316] flex items-center justify-center text-[#0a0a0a] text-sm font-bold">
                D
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-8">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {/* Empty State Container */}
          <div
            data-testid="empty-state-no-plans"
            className="flex flex-col items-center justify-center text-center py-20 px-4"
          >
            {/* Icon */}
            <div className="w-24 h-24 rounded-full bg-[#f97316]/10 border-2 border-[#f97316]/20 flex items-center justify-center mb-8">
              <span className="text-5xl">🍽️</span>
            </div>

            {/* Heading */}
            <p className="text-xs font-mono tracking-[0.2em] uppercase text-[#a1a1aa] mb-3">
              /// GET STARTED
            </p>
            <h2 className="text-3xl md:text-4xl font-heading uppercase tracking-tight text-[#fafafa] mb-4">
              NO MEAL PLANS YET<span className="text-[#f97316]">.</span>
            </h2>

            {/* Description */}
            <p className="text-[#a1a1aa] text-base max-w-md mb-8 leading-relaxed">
              Generate your first personalized 7-day meal plan tailored to your goals, preferences, and macros.
            </p>

            {/* CTA Button */}
            <Link
              href="/generate"
              data-testid="generate-first-plan-cta"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] text-sm font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg shadow-[#f97316]/20 hover:shadow-[#f97316]/30 hover:scale-[1.02]"
            >
              <span>⚡</span>
              Generate Your First Plan
              <span>→</span>
            </Link>

            {/* Sub-actions */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
              <div className="flex flex-col items-center p-4 card-elevation border border-[#2a2a2a] rounded-xl">
                <span className="text-2xl mb-2">🎯</span>
                <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                  Set Goals
                </p>
              </div>
              <div className="flex flex-col items-center p-4 card-elevation border border-[#2a2a2a] rounded-xl">
                <span className="text-2xl mb-2">📊</span>
                <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                  Track Macros
                </p>
              </div>
              <div className="flex flex-col items-center p-4 card-elevation border border-[#2a2a2a] rounded-xl">
                <span className="text-2xl mb-2">🛒</span>
                <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                  Grocery Lists
                </p>
              </div>
            </div>

            <p className="text-xs text-[#a1a1aa] mt-8">
              Your AI-powered nutrition protocol starts here
            </p>
          </div>

          {/* ═══ TODAY'S LOG (EMPTY STATE) ═══ */}
          <section
            data-testid="todays-log-section"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mt-8 max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                /// Today&apos;s Log
              </p>
              <span className="text-xs text-[#a1a1aa]">
                0 items logged
              </span>
            </div>
            <div data-testid="empty-log-state" className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#f97316]/10 flex items-center justify-center">
                <span className="text-3xl">🍽️</span>
              </div>
              <div>
                <p className="text-[#fafafa] text-sm font-semibold">No meals logged yet today</p>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Start tracking to see your progress toward today&apos;s goals.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <Link
                  href="/tracking"
                  data-testid="log-first-meal-btn"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] rounded-xl transition-colors"
                >
                  <span>🔥</span> Log Your First Meal
                </Link>
              </div>
            </div>
          </section>

          {/* ═══ QUICK ACTIONS BAR ═══ */}
          <section
            data-testid="quick-actions-section"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mt-4 max-w-2xl mx-auto"
          >
            <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-4">
              /// Quick Actions
            </p>
            <div className="flex flex-wrap gap-3">
              <QuickAction
                icon="📋"
                label="Log from Plan"
                href="/dashboard#todays-plan"
              />
              <QuickAction
                icon="🔍"
                label="Search Food"
                href="/tracking?mode=search"
              />
              <QuickAction
                icon="⚡"
                label="Quick Add"
                href="/tracking?mode=quick"
              />
            </div>
          </section>
        </main>
      </div>
    )
  }

  const macros = {
    calories: { current: current.calories, target: targets.calories },
    protein: { current: current.protein, target: targets.protein },
    carbs: { current: current.carbs, target: targets.carbs },
    fat: { current: current.fat, target: targets.fat },
  }

  const remaining = {
    calories: macros.calories.target - macros.calories.current,
    protein: macros.protein.target - macros.protein.current,
  }

  // Determine if user is over budget for any macro
  const isOverCalories = remaining.calories < 0
  const isOverProtein = remaining.protein < 0

  // Determine which slots have already been logged today
  const loggedSlots = new Set(
    trackedMeals
      .filter(tm => tm.source === 'plan_meal')
      .map(tm => tm.mealSlot?.toLowerCase())
  )

  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-heading uppercase tracking-wide text-[#fafafa]">
            <span className="text-[#f97316]">///</span> Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">
                Daily Target
              </span>
              <span className="text-lg font-bold font-mono text-[#f97316]">
                {macros.calories.target.toLocaleString()} kcal
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-[#f97316] flex items-center justify-center text-[#0a0a0a] text-sm font-bold">
              D
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Page Title */}
        <div className="space-y-2">
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-[#a1a1aa]">
            /// DASHBOARD
          </p>
          <h2 className="text-4xl font-heading uppercase tracking-tight">
            WELCOME BACK<span className="text-[#f97316]">.</span>
          </h2>
          <p className="text-[#a1a1aa]">
            Your nutrition protocol is ready.
          </p>
        </div>

        {/* ═══ MACRO RINGS SECTION ═══ */}
        <section
          data-testid="macro-rings-section"
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
              /// Macro Rings
            </p>
            <div className="flex items-center gap-3">
              {isTrainingDay ? (
                <span
                  data-testid="training-day-badge"
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30"
                >
                  Training Day +{trainingBonusKcal} kcal
                </span>
              ) : (
                <span
                  data-testid="rest-day-badge"
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30"
                >
                  Rest Day
                </span>
              )}
              <p className="text-xs text-[#a1a1aa]">Today</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 md:gap-8 justify-items-center">
            <MacroRing
              label="Calories"
              current={macros.calories.current}
              target={macros.calories.target}
              unit="kcal"
              color="#f97316"
              size={120}
            />
            <MacroRing
              label="Protein"
              current={macros.protein.current}
              target={macros.protein.target}
              unit="g"
              color="#3b82f6"
              size={120}
            />
            <MacroRing
              label="Carbs"
              current={macros.carbs.current}
              target={macros.carbs.target}
              unit="g"
              color="#f59e0b"
              size={120}
            />
            <MacroRing
              label="Fat"
              current={macros.fat.current}
              target={macros.fat.target}
              unit="g"
              color="#ef4444"
              size={120}
            />
          </div>

          {/* Remaining Budget */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#a1a1aa]">
              {isOverProtein ? (
                <span className="text-[#ef4444] font-semibold">
                  {Math.abs(remaining.protein)}g protein over
                </span>
              ) : (
                <span className="text-[#3b82f6] font-semibold">
                  {remaining.protein}g protein
                </span>
              )}
              {' '}·{' '}
              {isOverCalories ? (
                <span className="text-[#ef4444] font-semibold">
                  {Math.abs(remaining.calories)} kcal over
                </span>
              ) : (
                <span className="text-[#f97316] font-semibold">
                  {remaining.calories} kcal
                </span>
              )}{' '}
              {isOverCalories || isOverProtein ? '' : 'remaining'}
            </p>
          </div>
        </section>

        {/* ═══ ADHERENCE SCORE SECTION ═══ */}
        <section
          data-testid="adherence-score-section"
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
              /// Adherence Score
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="flex flex-col items-center">
                <span data-testid="adherence-score-today" className="text-4xl sm:text-5xl font-black text-[#22c55e] font-mono">
                  {adherenceScore}
                </span>
                <span className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mt-1">
                  Today
                </span>
              </div>
              <div className="h-12 w-px bg-[#2a2a2a]" />
              {weeklyAverageAdherence !== null && weeklyAverageAdherence !== undefined ? (
                <div className="flex flex-col items-center">
                  <span data-testid="adherence-score-weekly" className="text-2xl sm:text-3xl font-bold font-mono" style={{
                    color: weeklyAverageAdherence >= 80 ? '#22c55e' : weeklyAverageAdherence >= 50 ? '#eab308' : '#ef4444'
                  }}>
                    {weeklyAverageAdherence}
                  </span>
                  <span className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mt-1">
                    7-Day Avg
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-[#a1a1aa]">—</span>
                  <span className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mt-1">
                    7-Day Avg
                  </span>
                </div>
              )}
            </div>
            <div className="hidden sm:block h-12 w-px bg-[#2a2a2a]" />
            <div className="w-full sm:flex-1">
              <div
                className="h-3 bg-[#2a2a2a] rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Daily adherence score"
                aria-valuenow={adherenceScore}
                aria-valuemax={100}
                aria-valuetext={`${adherenceScore}% daily adherence`}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#22c55e] to-[#22c55e]/70 rounded-full transition-all duration-700"
                  style={{ width: `${adherenceScore}%` }}
                />
              </div>
              <p className="text-[10px] text-[#a1a1aa] mt-1">
                0 — 100 daily score
              </p>
            </div>
          </div>
        </section>

        {/* Two-column layout for Plan + Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ═══ TODAY'S PLAN SECTION ═══ */}
          <section
            id="todays-plan"
            data-testid="todays-plan-section"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                /// Today&apos;s Plan
              </p>
              <Link
                href="/meal-plan"
                className="text-xs text-[#f97316] hover:text-[#ea580c] font-semibold uppercase tracking-wide transition-colors py-4 px-2 -mx-2 inline-block"
              >
                View Full Plan →
              </Link>
            </div>
            {todayPlanMeals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#a1a1aa] text-sm">No meal plan for today.</p>
                <Link
                  href="/generate"
                  className="text-[#f97316] text-sm mt-2 inline-block hover:underline py-4 px-2 -mx-2"
                >
                  Generate a plan →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {todayPlanMeals.map((meal) => (
                  <PlanMealCard
                    key={meal.slot}
                    mealSlot={meal.slot.charAt(0).toUpperCase() + meal.slot.slice(1)}
                    name={meal.name}
                    calories={meal.calories}
                    protein={meal.protein}
                    carbs={meal.carbs}
                    fat={meal.fat}
                    prepTime={meal.prepTime}
                    isLogged={loggedSlots.has(meal.slot.toLowerCase())}
                    isLogging={loggingSlot === meal.slot}
                    onLog={() => openLogModal(meal)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ═══ TODAY'S LOG SECTION ═══ */}
          <section
            data-testid="todays-log-section"
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
                /// Today&apos;s Log
              </p>
              <span className="text-xs text-[#a1a1aa]">
                {trackedMeals.length} item{trackedMeals.length !== 1 ? 's' : ''} logged
              </span>
            </div>
            {trackedMeals.length === 0 ? (
              <div data-testid="empty-log-state" className="text-center py-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#f97316]/10 flex items-center justify-center">
                  <span className="text-3xl">🍽️</span>
                </div>
                <div>
                  <p className="text-[#fafafa] text-sm font-semibold">No meals logged yet today</p>
                  <p className="text-xs text-[#a1a1aa] mt-1">
                    Start tracking to see your progress toward today&apos;s goals.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  {todayPlanMeals.length > 0 ? (
                    <p className="text-xs text-[#a1a1aa]">
                      Tap <span className="text-[#f97316] font-bold">&quot;Log&quot;</span> on a plan meal to get started!
                    </p>
                  ) : (
                    <Link
                      href="/tracking"
                      data-testid="log-first-meal-btn"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] rounded-xl transition-colors"
                    >
                      <span>🔥</span> Log Your First Meal
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {trackedMeals.map((entry) => (
                  <LogEntry
                    key={entry.id}
                    id={entry.id}
                    name={entry.name}
                    calories={entry.calories}
                    protein={Math.round(entry.protein)}
                    carbs={entry.carbs}
                    fat={entry.fat}
                    portion={entry.portion || 1}
                    source={entry.source}
                    confidenceScore={entry.confidenceScore}
                    time={formatTime(entry.createdAt)}
                    onAdjust={handleAdjustPortion}
                    isAdjusting={adjustingMealId === entry.id}
                  />
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] text-center">
              <p className="text-xs text-[#a1a1aa]">
                Log meals to see your progress update in real-time
              </p>
            </div>
          </section>
        </div>

        {/* ═══ QUICK ACTIONS BAR ═══ */}
        <section
          data-testid="quick-actions-section"
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6"
        >
          <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-4">
            /// Quick Actions
          </p>
          <div className="flex flex-wrap gap-3">
            <QuickAction
              icon="📋"
              label="Log from Plan"
              href="/dashboard#todays-plan"
            />
            <QuickAction
              icon="🔍"
              label="Search Food"
              href="/tracking?mode=search"
            />
            <QuickAction
              icon="⚡"
              label="Quick Add"
              href="/tracking?mode=quick"
            />
          </div>
        </section>
      </main>

      {/* Log Confirmation Modal */}
      {mealToLog && (
        <LogConfirmModal
          meal={mealToLog}
          onConfirm={handleLogFromPlan}
          onCancel={() => setMealToLog(null)}
          isLogging={loggingSlot !== null}
        />
      )}
    </div>
  )
}
