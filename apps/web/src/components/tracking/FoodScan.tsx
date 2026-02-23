'use client';

import { useState, useRef } from 'react';
import { ClaudeVisionClient, FoodAnalysisResult } from '@/lib/vision/claude-vision';
import { IdleState } from './food-scan/IdleState';
import { AnalyzingState } from './food-scan/AnalyzingState';
import { ReviewState } from './food-scan/ReviewState';
import { ErrorState } from './food-scan/ErrorState';
import { SuccessState } from './food-scan/SuccessState';

interface FoodScanProps {
  onMealLogged?: () => void;
}

type ScanState = 'idle' | 'capturing' | 'analyzing' | 'reviewing' | 'error' | 'success';

const NUTRITION_BOUNDS: Record<string, { min: number; max: number }> = {
  calories: { min: 0, max: 5000 },
  protein_g: { min: 0, max: 300 },
  carbs_g: { min: 0, max: 500 },
  fat_g: { min: 0, max: 300 },
  fiber_g: { min: 0, max: 100 },
};

export default function FoodScan({ onMealLogged }: FoodScanProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [imageData, setImageData] = useState<string | null>(null);
  const [_analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [adjustedResult, setAdjustedResult] = useState<FoodAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const validation = ClaudeVisionClient.validateImageFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setState('error');
      return;
    }

    try {
      const base64 = await ClaudeVisionClient.fileToBase64(file);
      setImageData(base64);
      setState('analyzing');
      setError('');
      await analyzeImage(base64);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process image';
      setError(message);
      setState('error');
    }
  };

  const analyzeImage = async (base64: string) => {
    try {
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: base64,
          scanType: 'food_plate',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Analysis failed');
      }

      const data = await response.json();

      setScanId(data.scanId);
      setAnalysisResult(data.result);
      setAdjustedResult(data.result);
      setState('reviewing');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setState('error');
    }
  };

  const handleAdjust = (field: keyof FoodAnalysisResult['estimated_nutrition'], value: string) => {
    if (!adjustedResult) return;

    const numValue = parseFloat(value) || 0;
    const bounds = NUTRITION_BOUNDS[field];
    const clampedValue = bounds ? Math.max(bounds.min, Math.min(bounds.max, numValue)) : numValue;

    setAdjustedResult({
      ...adjustedResult,
      estimated_nutrition: {
        ...adjustedResult.estimated_nutrition,
        [field]: clampedValue,
      },
    });
  };

  const handleConfirm = async () => {
    if (!adjustedResult || !scanId) return;

    try {
      const response = await fetch('/api/vision/log-meal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanId,
          adjustedResult,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to log meal');
      }

      setState('success');

      // Reset after 2 seconds
      setTimeout(() => {
        reset();
        onMealLogged?.();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log meal';
      setError(message);
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setImageData(null);
    setAnalysisResult(null);
    setAdjustedResult(null);
    setScanId(null);
    setError('');
  };

  if (state === 'idle') {
    return <IdleState fileInputRef={fileInputRef} onFileSelect={handleFileSelect} />;
  }

  if (state === 'analyzing') {
    return <AnalyzingState imageData={imageData} />;
  }

  if (state === 'reviewing' && adjustedResult) {
    return (
      <ReviewState
        adjustedResult={adjustedResult}
        imageData={imageData}
        onReset={reset}
        onConfirm={handleConfirm}
        onAdjust={handleAdjust}
        onNameChange={(name) => setAdjustedResult({ ...adjustedResult, meal_name: name })}
        nutritionBounds={NUTRITION_BOUNDS}
      />
    );
  }

  if (state === 'error') {
    return <ErrorState error={error} onReset={reset} />;
  }

  if (state === 'success') {
    return <SuccessState />;
  }

  return null;
}
