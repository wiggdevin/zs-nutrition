'use client'

import NavBar from '@/components/navigation/NavBar'
import { WeightTrackingCard } from '@/components/tracking/WeightTrackingCard'
import { AdaptiveCalorieCard } from '@/components/tracking/AdaptiveCalorieCard'

export default function AdaptiveNutritionPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Adaptive Nutrition</h1>
            <p className="text-[#a1a1aa] mb-6">
              Track your weight weekly and get adaptive calorie adjustments based on your progress.
            </p>

            {/* Weight Tracking Section */}
            <div className="mb-8">
              <WeightTrackingCard />
            </div>

            {/* Adaptive Calorie Suggestions */}
            <div>
              <AdaptiveCalorieCard />
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">How Adaptive Calories Work</h2>
              <div className="space-y-3 text-sm text-[#a1a1aa]">
                <p>
                  <strong className="text-[#fafafa]">1. Log Weekly:</strong> Record your weight at least once per
                  week, ideally at the same time of day (e.g., Monday mornings, fasted).
                </p>
                <p>
                  <strong className="text-[#fafafa]">2. Track Progress:</strong> The system analyzes your weight
                  trend and compares it to your goal rate (e.g., 0.5-1 lb/week for cutting).
                </p>
                <p>
                  <strong className="text-[#fafafa]">3. Get Suggestions:</strong> If you deviate from your target
                  rate, the system will suggest calorie adjustments to get you back on track.
                </p>
                <p>
                  <strong className="text-[#fafafa]">4. Stay Safe:</strong> All adjustments are kept within safe
                  bounds (BMR + 200 to BMR + 1500) to ensure healthy metabolic function.
                </p>
                <p>
                  <strong className="text-[#fafafa]">5. Prevent Plateaus:</strong> Gradual calorie adjustments help
                  prevent metabolic adaptation and keep progress steady toward your goal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
