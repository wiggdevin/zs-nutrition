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
          <div className="max-w-4xl mx-auto space-y-4">
            <WeightTrackingCard />
            <AdaptiveCalorieCard />
          </div>
        </div>
      </div>
    </>
  );
}
