'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import NavBar from '@/components/navigation/NavBar';
import { useMealPlanData } from './useMealPlanData';
import { DayNavigator } from './DayNavigator';
import { DayColumn } from './MealCard';
import { SwapMealModal } from './SwapMealModal';
import { GroceryList } from './GroceryList';
import { normalizeGroceryList } from './utils';
import { MealPlanSkeleton } from './MealPlanSkeleton';
import { MealPlanEmptyState } from './MealPlanEmptyState';
import { PlanReplacedBanner } from './PlanReplacedBanner';
import { SwapErrorToast } from './SwapErrorToast';
import { useSwipeNavigation } from './useSwipeNavigation';

const MealDetailModal = dynamic(() => import('./MealDetailModal'), {
  ssr: false,
});

const PlanVersionHistory = dynamic(() => import('./PlanVersionHistory'), {
  ssr: false,
});

const MealPrepMode = dynamic(() => import('./MealPrepMode'), {
  ssr: false,
});

export default function MealPlanPage() {
  const {
    plan,
    loading,
    error,
    activeTab,
    setActiveTab,
    swapTarget,
    swapAlternatives,
    swapLoading,
    swappingMeal,
    swapSuccess,
    swapError,
    setSwapError,
    selectedMeal,
    setSelectedMeal,
    planReplaced,
    fetchPlan,
    handleSwapClick,
    handleSwapSelect,
    handleSwapClose,
    handleUndoClick,
    handleDismissReplacedBanner,
    handleViewNewerPlan,
  } = useMealPlanData();

  const [prepMode, setPrepMode] = useState(false);
  const days = plan?.validatedPlan?.days || [];
  const swipe = useSwipeNavigation({ totalDays: days.length });

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <MealPlanSkeleton />
        </div>
      </>
    );
  }

  if (error || !plan) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <MealPlanEmptyState error={error} onRetry={fetchPlan} />
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      {planReplaced && (
        <PlanReplacedBanner
          onViewNewer={handleViewNewerPlan}
          onDismiss={handleDismissReplacedBanner}
        />
      )}
      <div className={`md:pt-14 pb-20 md:pb-0 ${planReplaced ? 'md:mt-12' : ''}`}>
        <div className="min-h-screen bg-background text-foreground">
          <DayNavigator activeTab={activeTab} onTabChange={setActiveTab} plan={plan} />

          {/* Prep Mode Toggle */}
          {activeTab === 'meal-plan' && days.length > 0 && (
            <div className="mx-auto max-w-[1600px] px-4 pt-4 flex items-center gap-3">
              <button
                onClick={() => setPrepMode(!prepMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors ${
                  prepMode
                    ? 'bg-primary text-background'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
                data-testid="prep-mode-toggle"
              >
                <span>{prepMode ? '\u2715' : '\uD83C\uDF73'}</span>
                <span>{prepMode ? 'Exit Prep Mode' : 'Prep Mode'}</span>
              </button>
              {!prepMode && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Organize meals by protein for batch cooking
                </span>
              )}
            </div>
          )}

          {/* 7-day grid - Responsive layout */}
          {activeTab === 'meal-plan' && !prepMode && (
            <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="meal-plan-view">
              <div
                ref={swipe.scrollRef}
                onScroll={swipe.handleScroll}
                onTouchStart={swipe.handleTouchStart}
                onTouchMove={swipe.handleTouchMove}
                onTouchEnd={swipe.handleTouchEnd}
                className="
                  flex overflow-x-auto snap-x snap-mandatory scrollbar-none
                  md:grid md:grid-cols-3 md:gap-3 md:overflow-x-visible
                  lg:grid-cols-4
                  xl:grid-cols-5
                  2xl:grid-cols-7
                "
                data-testid="seven-day-grid"
              >
                {days.map((day, dayIdx) => (
                  <div
                    key={day.dayNumber}
                    className="w-full flex-shrink-0 snap-start snap-always px-2 md:w-auto md:flex-shrink-1 md:px-0"
                    style={{ animationDelay: `${dayIdx * 50}ms` }}
                  >
                    <DayColumn
                      day={day}
                      swappingMeal={swappingMeal}
                      swapSuccess={swapSuccess}
                      swapInProgress={swapLoading || swappingMeal !== null}
                      onSwapClick={handleSwapClick}
                      onMealClick={(dayNumber, mealIdx, meal) =>
                        setSelectedMeal({ dayNumber, mealIdx, meal })
                      }
                      onUndoClick={handleUndoClick}
                    />
                  </div>
                ))}
              </div>

              {/* Mobile dot indicators */}
              {days.length > 1 && (
                <div className="flex justify-center gap-2 pt-3 pb-1 md:hidden">
                  {days.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => swipe.setCurrentDay(i)}
                      aria-label={`Go to day ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        swipe.currentDay === i ? 'w-6 bg-primary' : 'w-2 bg-border'
                      }`}
                    />
                  ))}
                </div>
              )}

              {days.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No meal plan data available.</p>
                </div>
              )}
            </div>
          )}

          {/* Meal Prep Mode View */}
          {activeTab === 'meal-plan' && prepMode && <MealPrepMode days={days} />}

          {/* Grocery List View */}
          {activeTab === 'grocery-list' && (
            <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="grocery-list-view">
              {plan.validatedPlan?.groceryList && plan.validatedPlan.groceryList.length > 0 ? (
                <GroceryList
                  groceryList={normalizeGroceryList(plan.validatedPlan.groceryList as unknown[])}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No grocery list available.</p>
                </div>
              )}
            </div>
          )}

          {/* Version History View */}
          {activeTab === 'history' && (
            <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="history-view">
              <PlanVersionHistory />
            </div>
          )}
        </div>
      </div>

      {/* Swap modal */}
      {swapTarget && (
        <SwapMealModal
          target={swapTarget}
          alternatives={swapAlternatives}
          loading={swapLoading}
          onSelect={handleSwapSelect}
          onClose={handleSwapClose}
        />
      )}

      {/* Swap error toast */}
      {swapError && <SwapErrorToast error={swapError} onDismiss={() => setSwapError(null)} />}

      {/* Meal detail modal */}
      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal.meal}
          dayNumber={selectedMeal.dayNumber}
          mealIdx={selectedMeal.mealIdx}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </>
  );
}
