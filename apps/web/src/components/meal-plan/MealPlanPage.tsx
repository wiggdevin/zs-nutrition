'use client';

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

const MealDetailModal = dynamic(() => import('./MealDetailModal'), {
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

  const days = plan.validatedPlan?.days || [];

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

          {/* 7-day grid - Responsive layout */}
          {activeTab === 'meal-plan' && (
            <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="meal-plan-view">
              <div
                className="
                  flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory
                  md:grid md:grid-cols-3 md:overflow-x-visible md:pb-0
                  lg:grid-cols-4
                  xl:grid-cols-5
                  2xl:grid-cols-7
                "
                data-testid="seven-day-grid"
              >
                {days.map((day) => (
                  <div key={day.dayNumber} className="min-w-[280px] snap-start md:min-w-0">
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

              {days.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No meal plan data available.</p>
                </div>
              )}
            </div>
          )}

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
