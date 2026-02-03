"use client";

import { useState, useEffect, useRef } from "react";
import {
  OnboardingData,
  defaultOnboardingData,
  TOTAL_STEPS,
} from "@/lib/onboarding-types";
import { Step1Demographics, isStep1Valid } from "./Step1Demographics";
import { Step2BodyMetrics, isStep2Valid } from "./Step2BodyMetrics";
import { Step3Goals, isStep3Valid } from "./Step3Goals";
import { Step4Dietary } from "./Step4Dietary";
import { Step5Lifestyle } from "./Step5Lifestyle";
import { Step6Preferences } from "./Step6Preferences";
import { ProgressBar } from "./ProgressBar";

const STORAGE_KEY = "zsn_onboarding_data";
const STEP_KEY = "zsn_onboarding_step";

// API response types
interface OnboardingStateResponse {
  currentStep: number;
  completed: boolean;
  stepData: Partial<OnboardingData>;
}

// Validation functions for each step
function isStepValid(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1:
      return isStep1Valid(data);
    case 2:
      return isStep2Valid(data);
    case 3:
      return isStep3Valid(data);
    // Other steps can add validation later
    default:
      return true;
  }
}

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const isSubmittingRef = useRef(false);
  const isLoadingFromServerRef = useRef(false);

  // Load saved state from database on mount, then fall back to localStorage
  useEffect(() => {
    const loadState = async () => {
      isLoadingFromServerRef.current = true;

      try {
        // Try to load from database first (cross-session persistence)
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const serverState: OnboardingStateResponse = await res.json();

          // If onboarding is completed, redirect to generate
          if (serverState.completed) {
            window.location.href = "/generate";
            return;
          }

          // Restore step and data from database
          if (serverState.currentStep >= 1 && serverState.currentStep <= TOTAL_STEPS) {
            setCurrentStep(serverState.currentStep);
          }

          // Merge server data with defaults (handle partial data)
          if (serverState.stepData && Object.keys(serverState.stepData).length > 0) {
            setData((prev) => ({
              ...prev,
              ...serverState.stepData,
            }));
          }
        }
      } catch (err) {
        // If server request fails, fall back to localStorage
        console.warn("Failed to load onboarding state from server, using localStorage:", err);
      }

      // Fall back to localStorage if server didn't have data or request failed
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        const savedStep = localStorage.getItem(STEP_KEY);

        // Only use localStorage if server didn't return data
        if (savedData) {
          const localData = JSON.parse(savedData);
          setData((prev) => {
            // Merge local data only if server data is empty
            const hasServerData = Object.keys(localData).some(
              (key) => localData[key] !== null && localData[key] !== ""
            );
            return hasServerData ? { ...prev, ...localData } : prev;
          });
        }

        if (savedStep) {
          const step = parseInt(savedStep, 10);
          if (step >= 1 && step <= TOTAL_STEPS) {
            setCurrentStep(step);
          }
        }
      } catch {
        // Ignore parse errors
      }

      setIsHydrated(true);
      isLoadingFromServerRef.current = false;
    };

    loadState();
  }, []);

  // Save state to database AND localStorage on change
  useEffect(() => {
    if (!isHydrated || isLoadingFromServerRef.current) return;

    // Save to localStorage for immediate UI responsiveness
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STEP_KEY, String(currentStep));

    // Save to database for cross-session persistence (debounced)
    const saveToDatabase = setTimeout(async () => {
      try {
        await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: currentStep,
            data: data,
            complete: false,
          }),
        });
      } catch (err) {
        // Silent fail - localStorage has the data
        console.warn("Failed to save onboarding state to server:", err);
      }
    }, 500); // Debounce to avoid too many requests

    return () => clearTimeout(saveToDatabase);
  }, [data, currentStep, isHydrated]);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    if (!isStepValid(currentStep, data)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setShowErrors(false);
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleComplete = async () => {
    if (!isStepValid(currentStep, data)) {
      setShowErrors(true);
      return;
    }
    // Guard against double-submit using ref (synchronous, race-condition safe)
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsCompleting(true);
    try {
      // First, update the onboarding state to mark completion
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          data: data,
          complete: true,
        }),
      });

      // Call API to persist profile to database
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileData: data }),
      });
      if (!res.ok) {
        console.error("Failed to save profile: status", res.status);
      }
    } catch (err) {
      console.error("Error saving profile:", err instanceof Error ? err.message : "Unknown error");
    }
    // Clear onboarding state from localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STEP_KEY);
    // Mark onboarding as complete
    localStorage.setItem("zsn_onboarding_complete", "true");
    // Save the profile data for plan generation
    localStorage.setItem("zsn_user_profile", JSON.stringify(data));
    // Redirect to plan generation
    window.location.href = "/generate";
  };

  const stepComponents: Record<number, React.ReactNode> = {
    1: <Step1Demographics data={data} updateData={updateData} showErrors={showErrors} />,
    2: <Step2BodyMetrics data={data} updateData={updateData} showErrors={showErrors} />,
    3: <Step3Goals data={data} updateData={updateData} showErrors={showErrors} />,
    4: <Step4Dietary data={data} updateData={updateData} />,
    5: <Step5Lifestyle data={data} updateData={updateData} />,
    6: <Step6Preferences data={data} updateData={updateData} />,
  };

  const stepTitles: Record<number, string> = {
    1: "Demographics",
    2: "Body Metrics",
    3: "Goals",
    4: "Dietary Preferences",
    5: "Lifestyle",
    6: "Preferences",
  };

  // Show loading state while hydrating from localStorage to prevent flicker
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 py-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent mx-auto" />
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa]">
            Welcome to Zero Sum
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
            /// ONBOARDING PROTOCOL INITIATED
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        {/* Step Title */}
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-[#f97316]">
            Step {currentStep} of {TOTAL_STEPS}
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#fafafa]">
            {stepTitles[currentStep]}
          </h2>
        </div>

        {/* Step Content */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-xl">
          {stepComponents[currentStep]}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between" role="navigation" aria-label="Onboarding steps navigation">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            aria-label="Go to previous step"
            className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#fafafa] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Back
          </button>

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={nextStep}
              aria-label="Continue to next step"
              className="rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              data-testid="onboarding-complete-btn"
              aria-label="Complete setup and generate meal plan"
              className="rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              {isCompleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Completing...
                </span>
              ) : (
                "Complete Setup"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
