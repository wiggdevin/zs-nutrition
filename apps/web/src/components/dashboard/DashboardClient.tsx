'use client';

import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/loaders/DashboardSkeleton';
import { AdaptiveNutritionBanner } from './AdaptiveNutritionBanner';
import { ActivitySyncStatus } from './ActivitySyncStatus';
import { useDashboardData } from './useDashboardData';
import { useDashboardComputations } from './useDashboardComputations';
import { DashboardHeader } from './DashboardHeader';
import { ErrorBanner } from './ErrorBanner';
import { PlanStaleBanner } from './PlanStaleBanner';
import { EmptyState } from './EmptyState';
import { MacroRingsSection } from './MacroRingsSection';
import { AdherenceScoreSection } from './AdherenceScoreSection';
import { TodaysPlanSection } from './TodaysPlanSection';
import { TodaysLogSection } from './TodaysLogSection';
import { QuickActionsSection } from './QuickActionsSection';

const LogConfirmModal = dynamic(() => import('./LogConfirmModal'), {
  ssr: false,
});
const WaterTrackingSection = dynamic(
  () => import('./WaterTrackingSection').then((m) => ({ default: m.WaterTrackingSection })),
  { ssr: false }
);
const MonthlyAdherenceSection = dynamic(
  () => import('./MonthlyAdherenceSection').then((m) => ({ default: m.MonthlyAdherenceSection })),
  { ssr: false }
);

export default function DashboardClient() {
  const {
    trackedMeals,
    targets,
    current,
    adherenceScore,
    weeklyAverageAdherence,
    planId,
    lastFetch,
    todayPlanMeals,
    loading,
    loggingSlot,
    adjustingMealId,
    error,
    mealToLog,
    needsOnboarding,
    isTrainingDay,
    trainingBonusKcal,
    isPlanStale,
    staleReason,
    setLoading,
    setError,
    fetchData,
    openLogModal,
    closeLogModal,
    handleLogFromPlan,
    handleAdjustPortion,
  } = useDashboardData();

  const { macros, remaining, isOverCalories, isOverProtein, loggedSlots, formatTime, hasNoPlan } =
    useDashboardComputations(current, targets, trackedMeals);

  if (needsOnboarding) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-testid="onboarding-redirect"
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">
            Redirecting to onboarding...
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <DashboardSkeleton />;

  if (error && trackedMeals.length === 0 && !lastFetch) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-testid="network-error-state"
      >
        <div className="text-center space-y-6 max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground mb-2">Oops! Something went wrong</p>
            <p className="text-sm text-muted-foreground" data-testid="error-message">
              {error}
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchData(true);
            }}
            data-testid="retry-button"
            aria-label="Retry loading dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-background text-sm font-bold uppercase tracking-wide rounded-xl transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (hasNoPlan(planId, todayPlanMeals.length)) {
    return (
      <EmptyState
        calorieTarget={targets.calories}
        error={error}
        onDismissError={() => setError(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader calorieTarget={macros.calories.target} />

      <main className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

        <div className="space-y-2">
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted-foreground">
            {'/// DASHBOARD'}
          </p>
          <h2 className="text-4xl font-heading uppercase tracking-tight">
            WELCOME BACK<span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground">Your nutrition protocol is ready.</p>
        </div>

        <AdaptiveNutritionBanner />
        <ActivitySyncStatus />

        {isPlanStale && <PlanStaleBanner staleReason={staleReason} />}

        <MacroRingsSection
          macros={macros}
          remaining={remaining}
          isOverCalories={isOverCalories}
          isOverProtein={isOverProtein}
          isTrainingDay={isTrainingDay}
          trainingBonusKcal={trainingBonusKcal}
        />

        <WaterTrackingSection />

        <AdherenceScoreSection
          adherenceScore={adherenceScore}
          weeklyAverageAdherence={weeklyAverageAdherence}
        />

        <MonthlyAdherenceSection />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaysPlanSection
            todayPlanMeals={todayPlanMeals}
            loggedSlots={loggedSlots}
            loggingSlot={loggingSlot}
            onLogMeal={openLogModal}
          />
          <TodaysLogSection
            trackedMeals={trackedMeals}
            todayPlanMealsCount={todayPlanMeals.length}
            formatTime={formatTime}
            onAdjustPortion={handleAdjustPortion}
            adjustingMealId={adjustingMealId}
          />
        </div>

        <QuickActionsSection />
      </main>

      {mealToLog && (
        <LogConfirmModal
          meal={mealToLog}
          onConfirm={handleLogFromPlan}
          onCancel={closeLogModal}
          isLogging={loggingSlot !== null}
        />
      )}
    </div>
  );
}
