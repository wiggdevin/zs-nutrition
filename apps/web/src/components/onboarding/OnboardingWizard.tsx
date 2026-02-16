'use client';

import { useState, useEffect, useRef } from 'react';
import { OnboardingData, defaultOnboardingData, TOTAL_STEPS } from '@/lib/onboarding-types';
import { logger } from '@/lib/safe-logger';
import { toast } from '@/lib/toast-store';
import { Step1Demographics, isStep1Valid } from './Step1Demographics';
import { Step2BodyMetrics, isStep2Valid } from './Step2BodyMetrics';
import { Step3Goals, isStep3Valid } from './Step3Goals';
import { Step4Dietary } from './Step4Dietary';
import { Step5Lifestyle } from './Step5Lifestyle';
import { Step6Preferences } from './Step6Preferences';
import { ProgressBar } from './ProgressBar';

const STORAGE_KEY = 'zsn_onboarding_data';
const STEP_KEY = 'zsn_onboarding_step';

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
        const res = await fetch('/api/onboarding');
        if (res.ok) {
          const serverState: OnboardingStateResponse = await res.json();

          // If onboarding is completed, redirect to dashboard
          if (serverState.completed) {
            window.location.href = '/dashboard';
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
        logger.warn('Failed to load onboarding state from server, using localStorage:', err);
      }

      // Fall back to localStorage if server didn't have data or request failed
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        const savedStep = localStorage.getItem(STEP_KEY);

        // Merge localStorage data with server data (localStorage takes precedence for incomplete data)
        if (savedData) {
          const localData = JSON.parse(savedData);
          setData((prev) => ({ ...prev, ...localData }));
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
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: currentStep,
            data: data,
            complete: false,
          }),
        });
      } catch (err) {
        // Silent fail - localStorage has the data
        logger.warn('Failed to save onboarding state to server:', err);
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
      // Single API call to create profile with full metabolic calculations
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: data }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save profile');
      }

      // Success: clear onboarding state and redirect to plan generation
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STEP_KEY);
      localStorage.setItem('zsn_onboarding_complete', 'true');
      localStorage.setItem('zsn_user_profile', JSON.stringify(data));
      window.location.href = '/generate?auto=true';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong saving your profile';
      logger.error('Error saving profile:', message);
      toast.error(message);
      isSubmittingRef.current = false;
      setIsCompleting(false);
    }
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
    1: 'Demographics',
    2: 'Body Metrics',
    3: 'Goals',
    4: 'Dietary Preferences',
    5: 'Lifestyle',
    6: 'Preferences',
  };

  // Show loading state while hydrating from localStorage to prevent flicker
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-heading uppercase tracking-wider text-foreground">
            Welcome to Zero Sum
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            /// ONBOARDING PROTOCOL INITIATED
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        {/* Step Title */}
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Step {currentStep} of {TOTAL_STEPS}
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground">{stepTitles[currentStep]}</h2>
        </div>

        {/* Step Content */}
        <div
          className="rounded-lg border border-border bg-card p-6 shadow-xl"
          role="form"
          aria-label={`Step ${currentStep}: ${stepTitles[currentStep]}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {stepComponents[currentStep]}
        </div>

        {/* Navigation */}
        <div
          className="flex items-center justify-between"
          role="navigation"
          aria-label="Onboarding steps navigation"
        >
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            aria-label="Go to previous step"
            className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back
          </button>

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={nextStep}
              aria-label="Continue to next step"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className="rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isCompleting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  Completing...
                </span>
              ) : (
                'Complete Setup'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
