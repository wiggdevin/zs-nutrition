'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { logger } from '@/lib/safe-logger';

export type GenerationStatus = 'idle' | 'generating' | 'enqueued' | 'completed' | 'failed';

const MAX_RECONNECT_ATTEMPTS = 5;

export function usePlanGeneration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [currentAgent, setCurrentAgent] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const hasNavigated = useRef(false);
  const isSubmitting = useRef(false);
  const autoTriggered = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUsingPolling = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user has completed onboarding
  useEffect(() => {
    const profile = localStorage.getItem('zsn_user_profile');
    const onboardingComplete = localStorage.getItem('zsn_onboarding_complete');
    setHasProfile(!!profile && onboardingComplete === 'true');
  }, []);

  const startPolling = useCallback((pollJobId: string) => {
    let pollCount = 0;
    const MAX_POLLS = 180; // 6 minutes at 2s intervals

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;

      if (pollCount > MAX_POLLS) {
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        setErrorMessage('Plan generation timed out. Please try again.');
        setStatus('failed');
        isSubmitting.current = false;
        return;
      }

      try {
        const response = await fetch('/api/trpc/plan.getJobStatus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ json: { jobId: pollJobId } }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result.data) {
            const jobStatus = data.result.data;
            if (jobStatus.currentAgent !== undefined && jobStatus.currentAgent !== null) {
              setCurrentAgent(jobStatus.currentAgent);
            }
            if (jobStatus.status === 'completed') {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setStatus('completed');
              localStorage.setItem('zsn_plan_generated', 'true');
              if (jobStatus.planId) {
                localStorage.setItem('zsn_plan_id', jobStatus.planId);
              }
            } else if (jobStatus.status === 'failed') {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setErrorMessage(jobStatus.error || 'Plan generation failed');
              setStatus('failed');
              isSubmitting.current = false;
            }
          }
        }
      } catch (error) {
        logger.error('Polling error:', error);
      }
    }, 2000);
  }, []);

  const connectToSSE = useCallback(
    (streamJobId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/plan-stream/${streamJobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          reconnectAttemptsRef.current = 0;
          setIsReconnecting(false);

          if (data.agent) {
            setCurrentAgent(data.agent);
          }
          if (data.status === 'completed') {
            setStatus('completed');
            localStorage.setItem('zsn_plan_generated', 'true');
            if (data.planId) {
              localStorage.setItem('zsn_plan_id', data.planId);
            }
            eventSource.close();
            eventSourceRef.current = null;
          } else if (data.status === 'failed') {
            setErrorMessage(data.message || 'Plan generation failed');
            setStatus('failed');
            eventSource.close();
            eventSourceRef.current = null;
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          const backoffDelay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
            10000
          );
          logger.warn(
            `SSE connection lost (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}).`,
            `Reconnecting in ${backoffDelay}ms...`
          );
          setIsReconnecting(true);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectToSSE(streamJobId);
          }, backoffDelay);
        } else {
          setIsReconnecting(false);
          logger.warn(
            `Max SSE reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`,
            `Falling back to polling for job status`
          );
          isUsingPolling.current = true;
          startPolling(streamJobId);
        }
      };

      return eventSource;
    },
    [startPolling]
  );

  // Auto-start plan generation when redirected from onboarding with ?auto=true
  useEffect(() => {
    if (
      searchParams.get('auto') === 'true' &&
      hasProfile &&
      status === 'idle' &&
      !autoTriggered.current &&
      !isSubmitting.current
    ) {
      autoTriggered.current = true;
      const timer = setTimeout(() => {
        handleGenerate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasProfile, status]); // intentionally excluding handleGenerate to avoid re-trigger loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  // Auto-navigate to /meal-plan when generation completes
  useEffect(() => {
    if (status === 'completed' && !hasNavigated.current) {
      hasNavigated.current = true;
      const timer = setTimeout(() => {
        router.push('/meal-plan');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const handleGenerate = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    setStatus('generating');
    setCurrentAgent(0);
    setErrorMessage(null);

    const profileStr = localStorage.getItem('zsn_user_profile');
    if (!profileStr) {
      setErrorMessage('Profile data not found. Please complete onboarding first.');
      setStatus('failed');
      return;
    }

    try {
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        localStorage.setItem('zsn_plan_job_id', data.jobId);
        setStatus('enqueued');
        // Use polling directly — SSE is unusable on Vercel Hobby (10s timeout)
        startPolling(data.jobId);
        return;
      }

      setErrorMessage(
        data.message || data.error || 'Failed to start plan generation. Please try again.'
      );
      setStatus('failed');
      isSubmitting.current = false;
    } catch (err) {
      logger.error('Error starting plan generation:', err);
      setErrorMessage(
        'Network error while starting plan generation. Please check your connection and try again.'
      );
      setStatus('failed');
      isSubmitting.current = false;
    }
  };

  const handleRetry = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isSubmitting.current = false;
    isUsingPolling.current = false;
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);
    setStatus('idle');
    setCurrentAgent(0);
    setJobId(null);
    setErrorMessage(null);
  };

  return {
    status,
    currentAgent,
    hasProfile,
    jobId,
    errorMessage,
    isReconnecting,
    isUsingPolling: isUsingPolling.current,
    handleGenerate,
    handleRetry,
  };
}
