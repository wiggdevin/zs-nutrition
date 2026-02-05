'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast-store';
import { logger } from '@/lib/safe-logger';

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface SearchResultNutrition {
  servingDescription: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

interface SearchResultServing {
  servingDescription: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

interface FoodSearchResult {
  foodId: string;
  name: string;
  description: string;
  brandName?: string;
  verified?: boolean;
  nutrition?: SearchResultNutrition | null;
  servings?: SearchResultServing[];
}

interface FoodServing {
  servingId: string;
  servingDescription: string;
  metricServingAmount?: number;
  metricServingUnit?: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fiber?: number;
}

interface FoodDetails {
  foodId: string;
  name: string;
  brandName?: string;
  servings: FoodServing[];
}

const MAX_SEARCH_LENGTH = 200;

export default function FoodSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodDetails | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('');
  const [loggedDate, setLoggedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [isLogNetworkError, setIsLogNetworkError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [queryTooLong, setQueryTooLong] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogTimestampRef = useRef<number>(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);
  const [emptySubmitMessage, setEmptySubmitMessage] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (detailsAbortRef.current) detailsAbortRef.current.abort();
    };
  }, []);

  // Debounced autocomplete with abort controller for stale request protection
  const fetchAutocomplete = useCallback(async (q: string, page: number = 0) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchResults([]);
      setShowDropdown(false);
      setHasMore(false);
      setCurrentPage(0);
      return;
    }

    // Reset pagination on new search
    if (page === 0) {
      setCurrentPage(0);
      setCurrentQuery(trimmed);
    }

    // Abort any in-flight search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const generation = ++searchGenRef.current;

    if (page === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Fetch both autocomplete suggestions and search results in parallel (only for first page)
      let results: FoodSearchResult[] = [];
      let hasMoreResults = false;

      if (page === 0) {
        const [autoRes, searchRes] = await Promise.all([
          fetch(`/api/food-search?q=${encodeURIComponent(q)}&type=autocomplete`, {
            signal: controller.signal,
          }),
          fetch(`/api/food-search?q=${encodeURIComponent(q)}&type=search&max=8&page=0`, {
            signal: controller.signal,
          }),
        ]);

        // Discard stale responses
        if (generation !== searchGenRef.current) return;

        const autoData = await autoRes.json();
        const searchData = await searchRes.json();

        if (generation !== searchGenRef.current) return;

        setSuggestions(autoData.results || []);
        results = searchData.results || [];
        hasMoreResults = searchData.hasMore || false;
        setSearchResults(results);
        setHasMore(hasMoreResults);
        setShowDropdown(true);
      } else {
        // Load more results
        const searchRes = await fetch(
          `/api/food-search?q=${encodeURIComponent(q)}&type=search&max=8&page=${page}`,
          { signal: controller.signal }
        );

        // Discard stale responses
        if (generation !== searchGenRef.current) return;

        const searchData = await searchRes.json();

        if (generation !== searchGenRef.current) return;

        results = searchData.results || [];
        hasMoreResults = searchData.hasMore || false;

        // Append new results to existing results
        setSearchResults((prev) => [...prev, ...results]);
        setHasMore(hasMoreResults);
        setCurrentPage(page);
        setShowDropdown(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (generation !== searchGenRef.current) return;
      logger.error('Autocomplete error:', err);
    } finally {
      if (generation === searchGenRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // Clear empty submit message when user types
    if (emptySubmitMessage) {
      setEmptySubmitMessage(false);
    }

    // Enforce max length - truncate if over limit
    if (val.length > MAX_SEARCH_LENGTH) {
      setQueryTooLong(true);
      setQuery(val.slice(0, MAX_SEARCH_LENGTH));
      setSelectedFood(null);
      // Clear the too-long warning after 3 seconds
      setTimeout(() => setQueryTooLong(false), 3000);
      return;
    }

    setQueryTooLong(false);
    setQuery(val);
    setSelectedFood(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchAutocomplete(val);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        // Show empty submit message
        setEmptySubmitMessage(true);
        // Auto-hide after 3 seconds
        setTimeout(() => setEmptySubmitMessage(false), 3000);
      } else if (trimmed.length < 2) {
        // Query is too short
        setEmptySubmitMessage(true);
        setTimeout(() => setEmptySubmitMessage(false), 3000);
      }
      // Otherwise, let the normal search handle it (already debounced)
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion);
    setShowDropdown(false);
    setSuggestions([]);

    // Reset pagination and fetch results
    await fetchAutocomplete(suggestion, 0);
  };

  const handleLoadMore = async () => {
    if (!currentQuery || isLoadingMore) return;
    const nextPage = currentPage + 1;
    await fetchAutocomplete(currentQuery, nextPage);
  };

  const handleFoodSelect = async (food: FoodSearchResult) => {
    setShowDropdown(false);
    setQuery(food.name);
    setIsLoadingDetails(true);
    setSelectedServingIdx(0);
    setQuantity(1);
    setMealSlot('');
    setLoggedDate(new Date().toISOString().split('T')[0]); // Reset to today when selecting new food
    setLogSuccess(null);
    setLogError(null);

    // Abort any in-flight details request
    if (detailsAbortRef.current) {
      detailsAbortRef.current.abort();
    }
    const controller = new AbortController();
    detailsAbortRef.current = controller;

    try {
      const res = await fetch(`/api/food-search/details?id=${encodeURIComponent(food.foodId)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.food) {
        setSelectedFood(data.food);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      logger.error('Food details error:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleLogFood = async () => {
    if (!selectedFood || !currentServing) return;

    // Prevent rapid duplicate submissions (within 3 seconds)
    const now = Date.now();
    if (now - lastLogTimestampRef.current < 3000) {
      setLogError('Food was just logged. Please wait a moment before logging again.');
      return;
    }

    setIsLogging(true);
    setLogSuccess(null);
    setLogError(null);
    setIsLogNetworkError(false);

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
          mealSlot: mealSlot || undefined,
          loggedDate: loggedDate,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const totalKcal = Math.round(currentServing.calories * quantity);
        setLogSuccess(`Logged "${selectedFood.name}" (${totalKcal} kcal)`);

        // Show success toast
        toast.success(`${selectedFood.name} logged successfully`);

        setIsLogNetworkError(false);
        lastLogTimestampRef.current = Date.now();
        // Mark history state to prevent back-resubmit
        try {
          window.history.replaceState({ ...window.history.state, foodSearchSubmitted: true }, '');
        } catch {
          /* ignore */
        }
        // Reset after brief delay
        setTimeout(() => {
          setSelectedFood(null);
          setQuery('');
          setLogSuccess(null);
          setQuantity(1);
          setMealSlot('');
          setLoggedDate(new Date().toISOString().split('T')[0]); // Reset to today
          inputRef.current?.focus();
        }, 2500);
      } else {
        setLogError(data.error || 'Failed to log food');
        setIsLogNetworkError(false);
      }
    } catch {
      setLogError('Unable to connect. Please check your internet connection and try again.');
      setIsLogNetworkError(true);
    } finally {
      setIsLogging(false);
    }
  };

  const currentServing = selectedFood?.servings?.[selectedServingIdx];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
            role="combobox"
            aria-label="Search foods"
            aria-expanded={showDropdown && (suggestions.length > 0 || searchResults.length > 0)}
            aria-controls="food-search-listbox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
              if (suggestions.length > 0 || searchResults.length > 0) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => {
              // Delay to allow click events on dropdown to fire first
              setTimeout(() => setIsFocused(false), 200);
            }}
            placeholder="Search foods (e.g. chicken, rice, banana...)"
            maxLength={MAX_SEARCH_LENGTH}
            className={`w-full pl-10 pr-10 py-3 bg-card border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 transition-colors ${
              queryTooLong
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-border focus:border-primary focus:ring-primary'
            }`}
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {query.length > 0 && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                setSearchResults([]);
                setSelectedFood(null);
                setShowDropdown(false);
                setLogSuccess(null);
                setLogError(null);
                setIsLogNetworkError(false);
                setQueryTooLong(false);
                setEmptySubmitMessage(false);
                setQuantity(1);
                setMealSlot('');
                setLoggedDate(new Date().toISOString().split('T')[0]); // Reset to today
                setSelectedServingIdx(0);
                setCurrentPage(0);
                setHasMore(false);
                setCurrentQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary"
              aria-label="Clear search"
              data-testid="food-search-clear"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search Status (screen reader only) */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading && 'Searching for foods...'}
          {!isLoading &&
            showDropdown &&
            searchResults.length > 0 &&
            `${searchResults.length} food results found`}
          {!isLoading &&
            showDropdown &&
            searchResults.length === 0 &&
            query.trim().length >= 2 &&
            'No results found'}
        </div>

        {/* Query Too Long Warning */}
        {queryTooLong && (
          <div
            className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"
            data-testid="food-search-too-long"
          >
            <svg
              className="w-4 h-4 text-red-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-red-400 font-medium">
              Search query is too long (max {MAX_SEARCH_LENGTH} characters). Input has been
              truncated.
            </span>
          </div>
        )}

        {/* Empty Submit Message */}
        {emptySubmitMessage && (
          <div
            className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2"
            data-testid="food-search-empty-submit"
          >
            <svg
              className="w-4 h-4 text-yellow-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-yellow-400 font-medium">
              Enter a food name to search (at least 2 characters)
            </span>
          </div>
        )}

        {/* Empty Query Placeholder */}
        {isFocused && query.trim().length < 2 && !showDropdown && !selectedFood && !isLoading && (
          <div
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            data-testid="food-search-placeholder"
          >
            <div className="px-4 py-6 text-center">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-muted-foreground"
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
              <p className="text-sm text-muted-foreground font-medium">
                Type at least 2 characters to search
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Search over 1M+ verified foods from FatSecret
              </p>
            </div>
          </div>
        )}

        {/* No Results Empty State */}
        {showDropdown &&
          !isLoading &&
          suggestions.length === 0 &&
          searchResults.length === 0 &&
          query.trim().length >= 2 &&
          !selectedFood && (
            <div
              className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              data-testid="food-search-no-results"
            >
              <div className="px-4 py-6 text-center">
                <svg
                  className="w-10 h-10 mx-auto mb-3 text-muted-foreground"
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
                <p className="text-sm font-medium text-foreground">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No foods matched &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try a different spelling, a simpler term, or a more common food name
                </p>
              </div>
            </div>
          )}

        {/* Autocomplete Dropdown */}
        {showDropdown && (suggestions.length > 0 || searchResults.length > 0) && (
          <div
            ref={dropdownRef}
            id="food-search-listbox"
            role="listbox"
            aria-label="Food search results"
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
          >
            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-background">
                  Suggestions
                </div>
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={`sug-${idx}`}
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2.5 text-left text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                    title={suggestion}
                  >
                    <svg
                      className="w-4 h-4 text-muted-foreground flex-shrink-0"
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
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search results (foods) */}
            {searchResults.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-background">
                  Foods
                </div>
                {searchResults.map((food) => (
                  <button
                    key={food.foodId}
                    role="option"
                    aria-selected={false}
                    aria-label={`${food.name}${food.brandName ? `, ${food.brandName}` : ''}${food.nutrition ? `, ${food.nutrition.calories} calories` : ''}`}
                    onClick={() => handleFoodSelect(food)}
                    className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors border-b border-border last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground truncate" title={food.name}>
                        {food.name}
                      </div>
                      {food.verified && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success/20 text-success border border-success/30">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                    {food.brandName && (
                      <div className="text-xs text-primary mt-0.5 truncate" title={food.brandName}>
                        {food.brandName}
                      </div>
                    )}
                    {food.nutrition && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {food.nutrition.servingDescription}:
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">
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
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {food.servings.length} serving sizes available
                      </div>
                    )}
                  </button>
                ))}
                {/* Load More Button */}
                {hasMore && searchResults.length > 0 && (
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full px-4 py-3 text-center hover:bg-primary/10 transition-colors border-t border-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading more...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                        <span className="text-sm text-muted-foreground font-medium">
                          Load More Results
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading food details */}
      {isLoadingDetails && (
        <div className="mt-4 p-6 bg-card border border-border rounded-xl flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Loading food details...</span>
        </div>
      )}

      {/* Selected Food Details */}
      {selectedFood && !isLoadingDetails && (
        <div className="mt-4 p-4 sm:p-6 bg-card border border-border rounded-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1 mr-2">
              <h3 className="text-lg font-bold text-foreground break-words">{selectedFood.name}</h3>
              {selectedFood.brandName && (
                <p className="text-sm text-primary">{selectedFood.brandName}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedFood(null);
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Close food details"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Serving Size Selector */}
          {selectedFood.servings.length > 0 && (
            <div className="mb-4">
              <label
                id="food-serving-size-label"
                className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
              >
                Serving Size
              </label>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-labelledby="food-serving-size-label"
              >
                {selectedFood.servings.map((serving, idx) => (
                  <button
                    key={serving.servingId}
                    onClick={() => setSelectedServingIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors max-w-[200px] ${
                      selectedServingIdx === idx
                        ? 'bg-primary text-background'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground'
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
              <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {currentServing.calories}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Calories
                </div>
              </div>
              <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">
                  {currentServing.protein}g
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Protein
                </div>
              </div>
              <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-green-400">
                  {currentServing.carbohydrate}g
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Carbs
                </div>
              </div>
              <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-yellow-400">
                  {currentServing.fat}g
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Fat
                </div>
              </div>
            </div>
          )}

          {currentServing?.fiber !== undefined && currentServing.fiber !== null && (
            <div className="mt-3 text-sm text-muted-foreground">
              Fiber: <span className="text-foreground font-medium">{currentServing.fiber}g</span>
            </div>
          )}

          {/* Meal Slot Selector */}
          <div className="mt-4">
            <label
              htmlFor="food-meal-slot"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
            >
              Meal Slot{' '}
              <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </label>
            <select
              id="food-meal-slot"
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value as MealSlot | '')}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="food-meal-slot"
            >
              <option value="">No meal slot</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          {/* Date Selector */}
          <div className="mt-4">
            <label
              htmlFor="food-date"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
            >
              Date
            </label>
            <input
              id="food-date"
              type="date"
              value={loggedDate}
              onChange={(e) => setLoggedDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="food-date"
            />
          </div>

          {/* Quantity Selector and Log Button */}
          {currentServing && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                {/* Quantity Input */}
                <div className="flex-shrink-0">
                  <label
                    htmlFor="food-quantity"
                    className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
                  >
                    Quantity
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                      className="w-8 h-10 flex items-center justify-center bg-secondary text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors text-lg font-bold"
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
                      className="w-16 h-10 text-center bg-secondary border border-border rounded-lg text-foreground font-semibold focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 0.5)}
                      className="w-8 h-10 flex items-center justify-center bg-secondary text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors text-lg font-bold"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Adjusted Totals Preview */}
                {quantity !== 1 && (
                  <div className="flex-1 min-w-0 text-sm text-muted-foreground">
                    <span className="text-primary font-semibold">
                      {Math.round(currentServing.calories * quantity)}
                    </span>{' '}
                    kcal
                    {' · '}
                    <span className="text-blue-400 font-semibold">
                      {Math.round(currentServing.protein * quantity * 10) / 10}g
                    </span>{' '}
                    P{' · '}
                    <span className="text-green-400 font-semibold">
                      {Math.round(currentServing.carbohydrate * quantity * 10) / 10}g
                    </span>{' '}
                    C{' · '}
                    <span className="text-yellow-400 font-semibold">
                      {Math.round(currentServing.fat * quantity * 10) / 10}g
                    </span>{' '}
                    F
                  </div>
                )}

                {/* Log Food Button */}
                <button
                  onClick={handleLogFood}
                  disabled={isLogging}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-background font-bold uppercase tracking-wider rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLogging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
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
            <div
              className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400"
              role="status"
              aria-live="polite"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">{logSuccess}</span>
            </div>
          )}

          {/* Error Message */}
          {logError && (
            <div
              className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
              data-testid="food-search-log-error"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
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
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
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
  );
}
