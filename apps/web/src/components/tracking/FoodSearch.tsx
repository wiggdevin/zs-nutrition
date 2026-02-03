'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/lib/toast-store'

interface SearchResultNutrition {
  servingDescription: string
  calories: number
  protein: number
  carbohydrate: number
  fat: number
}

interface SearchResultServing {
  servingDescription: string
  calories: number
  protein: number
  carbohydrate: number
  fat: number
}

interface FoodSearchResult {
  foodId: string
  name: string
  description: string
  brandName?: string
  verified?: boolean
  nutrition?: SearchResultNutrition | null
  servings?: SearchResultServing[]
}

interface FoodServing {
  servingId: string
  servingDescription: string
  metricServingAmount?: number
  metricServingUnit?: string
  calories: number
  protein: number
  carbohydrate: number
  fat: number
  fiber?: number
}

interface FoodDetails {
  foodId: string
  name: string
  brandName?: string
  servings: FoodServing[]
}

const MAX_SEARCH_LENGTH = 200

export default function FoodSearch() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [selectedFood, setSelectedFood] = useState<FoodDetails | null>(null)
  const [selectedServingIdx, setSelectedServingIdx] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [isLogging, setIsLogging] = useState(false)
  const [logSuccess, setLogSuccess] = useState<string | null>(null)
  const [logError, setLogError] = useState<string | null>(null)
  const [isLogNetworkError, setIsLogNetworkError] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [queryTooLong, setQueryTooLong] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLogTimestampRef = useRef<number>(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const detailsAbortRef = useRef<AbortController | null>(null)
  const searchGenRef = useRef(0)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort()
      if (detailsAbortRef.current) detailsAbortRef.current.abort()
    }
  }, [])

  // Debounced autocomplete with abort controller for stale request protection
  const fetchAutocomplete = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    // Abort any in-flight search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
    const controller = new AbortController()
    searchAbortRef.current = controller
    const generation = ++searchGenRef.current

    setIsLoading(true)
    try {
      // Fetch both autocomplete suggestions and search results in parallel
      const [autoRes, searchRes] = await Promise.all([
        fetch(`/api/food-search?q=${encodeURIComponent(q)}&type=autocomplete`, { signal: controller.signal }),
        fetch(`/api/food-search?q=${encodeURIComponent(q)}&type=search&max=8`, { signal: controller.signal }),
      ])

      // Discard stale responses
      if (generation !== searchGenRef.current) return

      const autoData = await autoRes.json()
      const searchData = await searchRes.json()

      if (generation !== searchGenRef.current) return

      setSuggestions(autoData.results || [])
      setSearchResults(searchData.results || [])
      setShowDropdown(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (generation !== searchGenRef.current) return
      console.error('Autocomplete error:', err)
    } finally {
      if (generation === searchGenRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value

    // Enforce max length - truncate if over limit
    if (val.length > MAX_SEARCH_LENGTH) {
      setQueryTooLong(true)
      setQuery(val.slice(0, MAX_SEARCH_LENGTH))
      setSelectedFood(null)
      // Clear the too-long warning after 3 seconds
      setTimeout(() => setQueryTooLong(false), 3000)
      return
    }

    setQueryTooLong(false)
    setQuery(val)
    setSelectedFood(null)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchAutocomplete(val)
    }, 250)
  }

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion)
    setShowDropdown(false)
    setSuggestions([])

    // Abort any in-flight search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
    const controller = new AbortController()
    searchAbortRef.current = controller
    const generation = ++searchGenRef.current

    // Perform full search for the selected suggestion
    setIsLoading(true)
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(suggestion)}&type=search&max=10`, { signal: controller.signal })
      if (generation !== searchGenRef.current) return
      const data = await res.json()
      if (generation !== searchGenRef.current) return
      setSearchResults(data.results || [])
      setShowDropdown(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (generation !== searchGenRef.current) return
      console.error('Search error:', err)
    } finally {
      if (generation === searchGenRef.current) {
        setIsLoading(false)
      }
    }
  }

  const handleFoodSelect = async (food: FoodSearchResult) => {
    setShowDropdown(false)
    setQuery(food.name)
    setIsLoadingDetails(true)
    setSelectedServingIdx(0)
    setQuantity(1)
    setLogSuccess(null)
    setLogError(null)

    // Abort any in-flight details request
    if (detailsAbortRef.current) {
      detailsAbortRef.current.abort()
    }
    const controller = new AbortController()
    detailsAbortRef.current = controller

    try {
      const res = await fetch(`/api/food-search/details?id=${encodeURIComponent(food.foodId)}`, { signal: controller.signal })
      const data = await res.json()
      if (data.food) {
        setSelectedFood(data.food)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Food details error:', err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleLogFood = async () => {
    if (!selectedFood || !currentServing) return

    // Prevent rapid duplicate submissions (within 3 seconds)
    const now = Date.now()
    if (now - lastLogTimestampRef.current < 3000) {
      setLogError('Food was just logged. Please wait a moment before logging again.')
      return
    }

    setIsLogging(true)
    setLogSuccess(null)
    setLogError(null)
    setIsLogNetworkError(false)

    try {
      const res = await fetch('/api/tracking/fatsecret-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId: selectedFood.foodId,
          foodName: selectedFood.name,
          servingId: currentServing.servingId,
          servingDescription: currentServing.servingDescription,
          quantity,
          calories: currentServing.calories,
          protein: currentServing.protein,
          carbs: currentServing.carbohydrate,
          fat: currentServing.fat,
          fiber: currentServing.fiber,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const totalKcal = Math.round(currentServing.calories * quantity)
        setLogSuccess(`Logged "${selectedFood.name}" (${totalKcal} kcal)`)

        // Show success toast
        toast.success(`${selectedFood.name} logged successfully`)

        setIsLogNetworkError(false)
        lastLogTimestampRef.current = Date.now()
        // Mark history state to prevent back-resubmit
        try {
          window.history.replaceState(
            { ...window.history.state, foodSearchSubmitted: true },
            ''
          )
        } catch { /* ignore */ }
        // Reset after brief delay
        setTimeout(() => {
          setSelectedFood(null)
          setQuery('')
          setLogSuccess(null)
          setQuantity(1)
          inputRef.current?.focus()
        }, 2500)
      } else {
        setLogError(data.error || 'Failed to log food')
        setIsLogNetworkError(false)
      }
    } catch {
      setLogError('Unable to connect. Please check your internet connection and try again.')
      setIsLogNetworkError(true)
    } finally {
      setIsLogging(false)
    }
  }

  const currentServing = selectedFood?.servings?.[selectedServingIdx]

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a1a1aa]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            id="food-search-input"
            type="text"
            value={query}
            aria-label="Search foods"
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true)
              if (suggestions.length > 0 || searchResults.length > 0) {
                setShowDropdown(true)
              }
            }}
            onBlur={() => {
              // Delay to allow click events on dropdown to fire first
              setTimeout(() => setIsFocused(false), 200)
            }}
            placeholder="Search foods (e.g. chicken, rice, banana...)"
            maxLength={MAX_SEARCH_LENGTH}
            className={`w-full pl-10 pr-10 py-3 bg-[#1a1a1a] border rounded-xl text-[#fafafa] placeholder-[#666] focus:outline-none focus:ring-1 transition-colors ${
              queryTooLong
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-[#333] focus:border-[#f97316] focus:ring-[#f97316]'
            }`}
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {query.length > 0 && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSuggestions([])
                setSearchResults([])
                setSelectedFood(null)
                setShowDropdown(false)
                setLogSuccess(null)
                setLogError(null)
                setIsLogNetworkError(false)
                setQueryTooLong(false)
                setQuantity(1)
                setSelectedServingIdx(0)
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#666] hover:text-[#fafafa] transition-colors rounded-full hover:bg-[#333]"
              aria-label="Clear search"
              data-testid="food-search-clear"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Query Too Long Warning */}
        {queryTooLong && (
          <div
            className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"
            data-testid="food-search-too-long"
          >
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs text-red-400 font-medium">
              Search query is too long (max {MAX_SEARCH_LENGTH} characters). Input has been truncated.
            </span>
          </div>
        )}

        {/* Empty Query Placeholder */}
        {isFocused && query.trim().length < 2 && !showDropdown && !selectedFood && !isLoading && (
          <div
            className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
            data-testid="food-search-placeholder"
          >
            <div className="px-4 py-6 text-center">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-[#444]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm text-[#a1a1aa] font-medium">
                Type at least 2 characters to search
              </p>
              <p className="text-xs text-[#666] mt-1">
                Search over 1M+ verified foods from FatSecret
              </p>
            </div>
          </div>
        )}

        {/* No Results Empty State */}
        {showDropdown && !isLoading && suggestions.length === 0 && searchResults.length === 0 && query.trim().length >= 2 && !selectedFood && (
          <div
            className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
            data-testid="food-search-no-results"
          >
            <div className="px-4 py-6 text-center">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-[#444]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-[#fafafa]">
                No results found
              </p>
              <p className="text-xs text-[#a1a1aa] mt-1">
                No foods matched &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-[#666] mt-2">
                Try a different spelling, a simpler term, or a more common food name
              </p>
            </div>
          </div>
        )}

        {/* Autocomplete Dropdown */}
        {showDropdown && (suggestions.length > 0 || searchResults.length > 0) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
          >
            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider bg-[#111]">
                  Suggestions
                </div>
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={`sug-${idx}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2.5 text-left text-[#fafafa] hover:bg-[#f97316]/10 hover:text-[#f97316] transition-colors flex items-center gap-2"
                    title={suggestion}
                  >
                    <svg className="w-4 h-4 text-[#666] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search results (foods) */}
            {searchResults.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider bg-[#111]">
                  Foods
                </div>
                {searchResults.map((food) => (
                  <button
                    key={food.foodId}
                    onClick={() => handleFoodSelect(food)}
                    className="w-full px-4 py-3 text-left hover:bg-[#f97316]/10 transition-colors border-b border-[#222] last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="font-medium text-[#fafafa] truncate"
                        title={food.name}
                      >
                        {food.name}
                      </div>
                      {food.verified && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                    {food.brandName && (
                      <div
                        className="text-xs text-[#f97316] mt-0.5 truncate"
                        title={food.brandName}
                      >
                        {food.brandName}
                      </div>
                    )}
                    {food.nutrition && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-[#a1a1aa]">
                          {food.nutrition.servingDescription}:
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f97316]/15 text-[#f97316]">
                          {food.nutrition.calories} kcal
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400">
                          P {food.nutrition.protein}g
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400">
                          C {food.nutrition.carbohydrate}g
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/15 text-yellow-400">
                          F {food.nutrition.fat}g
                        </span>
                      </div>
                    )}
                    {food.servings && food.servings.length > 1 && (
                      <div className="mt-1 text-[10px] text-[#666]">
                        {food.servings.length} serving sizes available
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading food details */}
      {isLoadingDetails && (
        <div className="mt-4 p-6 bg-[#1a1a1a] border border-[#333] rounded-xl flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#a1a1aa]">Loading food details...</span>
        </div>
      )}

      {/* Selected Food Details */}
      {selectedFood && !isLoadingDetails && (
        <div className="mt-4 p-4 sm:p-6 bg-[#1a1a1a] border border-[#333] rounded-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1 mr-2">
              <h3 className="text-lg font-bold text-[#fafafa] break-words">{selectedFood.name}</h3>
              {selectedFood.brandName && (
                <p className="text-sm text-[#f97316]">{selectedFood.brandName}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedFood(null)
                setQuery('')
                inputRef.current?.focus()
              }}
              className="text-[#666] hover:text-[#fafafa] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Serving Size Selector */}
          {selectedFood.servings.length > 0 && (
            <div className="mb-4">
              <label id="food-serving-size-label" className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2">
                Serving Size
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="food-serving-size-label">
                {selectedFood.servings.map((serving, idx) => (
                  <button
                    key={serving.servingId}
                    onClick={() => setSelectedServingIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors max-w-[200px] ${
                      selectedServingIdx === idx
                        ? 'bg-[#f97316] text-[#0a0a0a]'
                        : 'bg-[#222] text-[#a1a1aa] hover:bg-[#333] hover:text-[#fafafa]'
                    }`}
                    title={serving.servingDescription}
                  >
                    <span className="truncate block">{serving.servingDescription}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nutrition Info */}
          {currentServing && (
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-[#111] rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#f97316]">{currentServing.calories}</div>
                <div className="text-[10px] sm:text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Calories</div>
              </div>
              <div className="bg-[#111] rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{currentServing.protein}g</div>
                <div className="text-[10px] sm:text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Protein</div>
              </div>
              <div className="bg-[#111] rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-green-400">{currentServing.carbohydrate}g</div>
                <div className="text-[10px] sm:text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Carbs</div>
              </div>
              <div className="bg-[#111] rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-yellow-400">{currentServing.fat}g</div>
                <div className="text-[10px] sm:text-xs text-[#a1a1aa] uppercase tracking-wider mt-1">Fat</div>
              </div>
            </div>
          )}

          {currentServing?.fiber !== undefined && currentServing.fiber !== null && (
            <div className="mt-3 text-sm text-[#a1a1aa]">
              Fiber: <span className="text-[#fafafa] font-medium">{currentServing.fiber}g</span>
            </div>
          )}

          {/* Quantity Selector and Log Button */}
          {currentServing && (
            <div className="mt-5 pt-4 border-t border-[#333]">
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                {/* Quantity Input */}
                <div className="flex-shrink-0">
                  <label htmlFor="food-quantity" className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                      className="w-8 h-10 flex items-center justify-center bg-[#222] text-[#a1a1aa] rounded-lg hover:bg-[#333] hover:text-[#fafafa] transition-colors text-lg font-bold"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <input
                      id="food-quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(0.1, Number(e.target.value) || 0.1))}
                      step="0.5"
                      min="0.1"
                      className="w-16 h-10 text-center bg-[#222] border border-[#333] rounded-lg text-[#fafafa] font-semibold focus:outline-none focus:border-[#f97316]"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 0.5)}
                      className="w-8 h-10 flex items-center justify-center bg-[#222] text-[#a1a1aa] rounded-lg hover:bg-[#333] hover:text-[#fafafa] transition-colors text-lg font-bold"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Adjusted Totals Preview */}
                {quantity !== 1 && (
                  <div className="flex-1 min-w-0 text-sm text-[#a1a1aa]">
                    <span className="text-[#f97316] font-semibold">{Math.round(currentServing.calories * quantity)}</span> kcal
                    {' · '}
                    <span className="text-blue-400 font-semibold">{Math.round(currentServing.protein * quantity * 10) / 10}g</span> P
                    {' · '}
                    <span className="text-green-400 font-semibold">{Math.round(currentServing.carbohydrate * quantity * 10) / 10}g</span> C
                    {' · '}
                    <span className="text-yellow-400 font-semibold">{Math.round(currentServing.fat * quantity * 10) / 10}g</span> F
                  </div>
                )}

                {/* Log Food Button */}
                <button
                  onClick={handleLogFood}
                  disabled={isLogging}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-[#f97316] text-[#0a0a0a] font-bold uppercase tracking-wider rounded-xl hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLogging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Log Food
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {logSuccess && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">{logSuccess}</span>
            </div>
          )}

          {/* Error Message */}
          {logError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl" data-testid="food-search-log-error">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <span className="text-sm font-medium text-red-400">{logError}</span>
                  {isLogNetworkError && (
                    <button
                      type="button"
                      onClick={handleLogFood}
                      disabled={isLogging}
                      className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="food-search-retry"
                    >
                      {isLogging ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
