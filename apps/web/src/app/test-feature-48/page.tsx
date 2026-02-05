"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";
import { Weekday, OnboardingData } from "@/lib/onboarding-types";
import { Step5Lifestyle } from "@/components/onboarding/Step5Lifestyle";

const defaultOnboardingData: OnboardingData = {
  // Step 1: Demographics
  name: "Test User",
  sex: "male",
  age: 30,

  // Step 2: Body Metrics
  heightFeet: 5,
  heightInches: 10,
  weightLbs: 175,

  // Step 3: Goals
  goalType: "maintain",
  goalRate: 0.5,

  // Step 4: Dietary
  dietaryStyle: "omnivore",
  allergies: [],
  exclusions: [],

  // Step 5: Lifestyle
  activityLevel: "moderately_active",
  trainingDays: [],
  cookingSkill: 5,
  prepTimeMax: 30,

  // Step 6: Preferences
  macroStyle: "balanced",
  cuisinePreferences: [],
  mealsPerDay: 3,
  snacksPerDay: 1,
};

export default function TestFeature48Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [selectedDays, setSelectedDays] = useState<string>("[]");

  const updateData = (partial: Partial<OnboardingData>) => {
    const newData = { ...data, ...partial };
    setData(newData);
    setSelectedDays(JSON.stringify(newData.trainingDays, null, 2));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <h1 className="text-3xl font-bold mb-2">Feature #48 Test</h1>
          <p className="text-[#a1a1aa] mb-4">Onboarding training days multi-select works</p>

          <div className="bg-[#0a0a0a] rounded p-4 mb-6">
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#f97316] mb-3">
              Test Steps
            </h2>
            <ol className="space-y-2 text-sm">
              <li className={data.trainingDays.includes("monday") ? "text-[#22c55e]" : "text-[#a1a1aa]"}>
                1. Click Monday - verify selected {data.trainingDays.includes("monday") ? "✅" : "⬜"}
              </li>
              <li className={data.trainingDays.includes("wednesday") ? "text-[#22c55e]" : "text-[#a1a1aa]"}>
                2. Click Wednesday - verify selected {data.trainingDays.includes("wednesday") ? "✅" : "⬜"}
              </li>
              <li className={data.trainingDays.includes("friday") ? "text-[#22c55e]" : "text-[#a1a1aa]"}>
                3. Click Friday - verify selected {data.trainingDays.includes("friday") ? "✅" : "⬜"}
              </li>
              <li className={!data.trainingDays.includes("monday") ? "text-[#22c55e]" : "text-[#a1a1aa]"}>
                4. Click Monday again - verify deselected {!data.trainingDays.includes("monday") ? "✅" : "⬜"}
              </li>
              <li className={data.trainingDays.length === 2 && !data.trainingDays.includes("monday") ? "text-[#22c55e]" : "text-[#a1a1aa]"}>
                5. Verify 2 days remain selected {data.trainingDays.length === 2 && !data.trainingDays.includes("monday") ? "✅" : "⬜"}
              </li>
            </ol>
          </div>

          <div className="bg-[#0a0a0a] rounded p-4">
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#f97316] mb-3">
              Current State: trainingDays
            </h2>
            <pre className="text-xs font-mono text-[#22c55e]">
              {selectedDays}
            </pre>
            <div className="mt-2 text-sm">
              <span className="text-[#a1a1aa]">Count: </span>
              <span className="text-[#f97316] font-bold">{data.trainingDays.length}</span>
              <span className="text-[#a1a1aa] ml-4">Days: </span>
              <span className="text-[#f97316] font-bold">
                {data.trainingDays.length > 0 ? data.trainingDays.join(", ") : "None selected"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <h2 className="text-xl font-bold mb-4">Step 5: Lifestyle Component</h2>
          <Step5Lifestyle data={data} updateData={updateData} />
        </div>

        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#f97316] mb-3">
            Manual Verification Buttons (Quick Test)
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateData({ trainingDays: ["monday"] })}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-sm"
            >
              Set Monday only
            </button>
            <button
              onClick={() => updateData({ trainingDays: ["monday", "wednesday", "friday"] })}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-sm"
            >
              Set Mon, Wed, Fri
            </button>
            <button
              onClick={() => updateData({ trainingDays: [] })}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-sm"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#f97316] mb-3">
            Expected Behavior
          </h2>
          <ul className="space-y-2 text-sm text-[#a1a1aa]">
            <li>• Clicking a day button should toggle it in the trainingDays array</li>
            <li>• Selected days should be highlighted with orange border and background</li>
            <li>• Unselected days should have dark gray border and background</li>
            <li>• Clicking the same day again should deselect it</li>
            <li>• Multiple days can be selected simultaneously</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
