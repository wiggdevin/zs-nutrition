'use client';

import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { WeightTrackingCard } from '@/components/tracking/WeightTrackingCard';
import { AdaptiveCalorieCard } from '@/components/tracking/AdaptiveCalorieCard';

export default function AdaptiveNutritionPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <PageHeader
          title="Adaptive Nutrition"
          showPrefix
          sticky
          maxWidth="screen-2xl"
          subtitle="Track your weight weekly and get adaptive calorie adjustments based on your progress."
        />
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Weight Tracking Section */}
            <div className="mb-8">
              <WeightTrackingCard />
            </div>

            {/* Adaptive Calorie Suggestions */}
            <div>
              <AdaptiveCalorieCard />
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">How Adaptive Calories Work</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">1. Log Weekly:</strong> Record your weight at
                  least once per week, ideally at the same time of day (e.g., Monday mornings,
                  fasted).
                </p>
                <p>
                  <strong className="text-foreground">2. Track Progress:</strong> The system
                  analyzes your weight trend and compares it to your goal rate (e.g., 0.5-1 lb/week
                  for cutting).
                </p>
                <p>
                  <strong className="text-foreground">3. Get Suggestions:</strong> If you deviate
                  from your target rate, the system will suggest calorie adjustments to get you back
                  on track.
                </p>
                <p>
                  <strong className="text-foreground">4. Stay Safe:</strong> All adjustments are
                  kept within safe bounds (BMR + 200 to BMR + 1500) to ensure healthy metabolic
                  function.
                </p>
                <p>
                  <strong className="text-foreground">5. Prevent Plateaus:</strong> Gradual calorie
                  adjustments help prevent metabolic adaptation and keep progress steady toward your
                  goal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
