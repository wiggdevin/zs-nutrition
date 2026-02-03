'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { ClaudeVisionClient, FoodAnalysisResult } from '@/lib/vision/claude-vision'
import Image from 'next/image'

interface FoodScanProps {
  onMealLogged?: () => void
}

type ScanState = 'idle' | 'capturing' | 'analyzing' | 'reviewing' | 'error' | 'success'

export default function FoodScan({ onMealLogged }: FoodScanProps) {
  const [state, setState] = useState<ScanState>('idle')
  const [imageData, setImageData] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [adjustedResult, setAdjustedResult] = useState<FoodAnalysisResult | null>(null)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    // Validate file
    const validation = ClaudeVisionClient.validateImageFile(file)

    if (!validation.valid) {
      setError(validation.error || 'Invalid file')
      setState('error')
      return
    }

    try {
      // Convert to base64
      const base64 = await ClaudeVisionClient.fileToBase64(file)
      setImageData(base64)
      setState('analyzing')
      setError('')
      await analyzeImage(base64)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process image'
      setError(message)
      setState('error')
    }
  }

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
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Analysis failed')
      }

      const data = await response.json()

      setScanId(data.scanId)
      setAnalysisResult(data.result)
      setAdjustedResult(data.result)
      setState('reviewing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      setError(message)
      setState('error')
    }
  }

  const handleAdjust = (field: keyof FoodAnalysisResult['estimated_nutrition'], value: string) => {
    if (!adjustedResult) return

    const numValue = parseFloat(value) || 0

    setAdjustedResult({
      ...adjustedResult,
      estimated_nutrition: {
        ...adjustedResult.estimated_nutrition,
        [field]: numValue,
      },
    })
  }

  const handleConfirm = async () => {
    if (!adjustedResult || !scanId) return

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
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to log meal')
      }

      setState('success')

      // Reset after 2 seconds
      setTimeout(() => {
        reset()
        onMealLogged?.()
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log meal'
      setError(message)
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setImageData(null)
    setAnalysisResult(null)
    setAdjustedResult(null)
    setScanId(null)
    setError('')
  }

  // Idle state - show capture button
  if (state === 'idle') {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-heading uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#f97316]" />
              Photo Analysis
            </h3>
            <p className="text-sm text-[#a1a1aa] mt-1">
              Snap a photo to instantly estimate calories and macros
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors"
        >
          <Camera className="w-5 h-5" />
          Take or Upload Photo
        </button>

        <div className="mt-4 text-xs text-[#a1a1aa] space-y-1">
          <p>💡 Tips for best results:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use good lighting (natural light works best)</li>
            <li>Capture the entire meal in frame</li>
            <li>Include a reference object (fork, plate) for portion size</li>
            <li>Avoid blurry or dark photos</li>
          </ul>
        </div>
      </div>
    )
  }

  // Analyzing state - show loading
  if (state === 'analyzing') {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <div className="flex flex-col items-center py-8">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mb-4" />
          <h3 className="text-lg font-heading uppercase tracking-wider mb-2">
            Analyzing Your Meal
          </h3>
          <p className="text-sm text-[#a1a1aa] text-center">
            Claude Vision is identifying ingredients and estimating nutrition...
          </p>
        </div>

        {imageData && (
          <div className="mt-4 rounded-lg overflow-hidden border border-[#2a2a2a]">
            <img
              src={imageData}
              alt="Captured meal"
              className="w-full h-48 object-cover"
            />
          </div>
        )}
      </div>
    )
  }

  // Review state - show results and allow adjustments
  if (state === 'reviewing' && adjustedResult) {
    const confidenceColor = adjustedResult.confidence_score >= 80
      ? 'text-[#22c55e]'
      : adjustedResult.confidence_score >= 60
        ? 'text-[#f59e0b]'
        : 'text-[#ef4444]'

    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading uppercase tracking-wider">
            Review Analysis
          </h3>
          <button
            onClick={reset}
            className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image */}
        {imageData && (
          <div className="mb-4 rounded-lg overflow-hidden border border-[#2a2a2a]">
            <img
              src={imageData}
              alt="Captured meal"
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Meal Name */}
        <div className="mb-4">
          <label className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-2 block">
            Meal Name
          </label>
          <input
            type="text"
            value={adjustedResult.meal_name}
            onChange={(e) => setAdjustedResult({ ...adjustedResult, meal_name: e.target.value })}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-[#fafafa] focus:outline-none focus:border-[#f97316]"
          />
        </div>

        {/* Description */}
        {adjustedResult.description && (
          <div className="mb-4">
            <p className="text-sm text-[#a1a1aa]">{adjustedResult.description}</p>
          </div>
        )}

        {/* Confidence Score */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
            Confidence:
          </span>
          <span className={`text-sm font-bold ${confidenceColor}`}>
            {adjustedResult.confidence_score}%
          </span>
        </div>

        {/* Nutrition Estimates - Editable */}
        <div className="mb-4">
          <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-3">
            /// Estimated Nutrition (Click to Edit)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1">Calories</label>
              <input
                type="number"
                value={Math.round(adjustedResult.estimated_nutrition.calories)}
                onChange={(e) => handleAdjust('calories', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#fafafa] focus:outline-none focus:border-[#f97316]"
              />
            </div>
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1">Protein (g)</label>
              <input
                type="number"
                value={Math.round(adjustedResult.estimated_nutrition.protein_g)}
                onChange={(e) => handleAdjust('protein_g', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#fafafa] focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1">Carbs (g)</label>
              <input
                type="number"
                value={Math.round(adjustedResult.estimated_nutrition.carbs_g)}
                onChange={(e) => handleAdjust('carbs_g', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#fafafa] focus:outline-none focus:border-[#22c55e]"
              />
            </div>
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1">Fat (g)</label>
              <input
                type="number"
                value={Math.round(adjustedResult.estimated_nutrition.fat_g)}
                onChange={(e) => handleAdjust('fat_g', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#fafafa] focus:outline-none focus:border-[#eab308]"
              />
            </div>
          </div>
        </div>

        {/* Detected Ingredients */}
        {adjustedResult.ingredients && adjustedResult.ingredients.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-2">
              Detected Ingredients
            </p>
            <div className="space-y-1">
              {adjustedResult.ingredients.map((ingredient, idx) => (
                <div key={idx} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                  <span className="text-[#fafafa]">{ingredient.name}</span>
                  <span className="text-[#a1a1aa]">({ingredient.amount})</span>
                  {ingredient.confidence === 'high' && (
                    <span className="text-xs text-[#22c55e]">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {adjustedResult.warnings && adjustedResult.warnings.length > 0 && (
          <div className="mb-4 p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[#f59e0b]">
                {adjustedResult.warnings.map((warning, idx) => (
                  <p key={idx}>{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#fafafa] font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            Log Meal
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="bg-[#1a1a1a] border border-[#ef4444]/30 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-heading uppercase tracking-wider text-[#ef4444] mb-2">
              Analysis Failed
            </h3>
            <p className="text-sm text-[#a1a1aa] mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#fafafa] font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="bg-[#1a1a1a] border border-[#22c55e]/30 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-[#22c55e]" />
          </div>
          <div>
            <h3 className="text-lg font-heading uppercase tracking-wider text-[#22c55e]">
              Meal Logged!
            </h3>
            <p className="text-sm text-[#a1a1aa]">
              Your meal has been added to today's tracking
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
