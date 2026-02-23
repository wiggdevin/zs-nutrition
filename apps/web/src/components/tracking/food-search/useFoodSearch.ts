'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast-store';
import { logger } from '@/lib/safe-logger';
import type { MealSlot, FoodSearchResult, FoodDetails, FoodServing } from './types';
import { MAX_SEARCH_LENGTH } from './types';
import { useFoodAutocomplete } from './useFoodAutocomplete';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function useFoodSearch() {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodDetails | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('');
  const [loggedDate, setLoggedDate] = useState<string>(getTodayString);
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [isLogNetworkError, setIsLogNetworkError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [queryTooLong, setQueryTooLong] = useState(false);
  const [emptySubmitMessage, setEmptySubmitMessage] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogTimestampRef = useRef<number>(0);
  const detailsAbortRef = useRef<AbortController | null>(null);

  const autocomplete = useFoodAutocomplete();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        autocomplete.setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [autocomplete]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (detailsAbortRef.current) detailsAbortRef.current.abort();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (emptySubmitMessage) {
      setEmptySubmitMessage(false);
    }

    if (val.length > MAX_SEARCH_LENGTH) {
      setQueryTooLong(true);
      setQuery(val.slice(0, MAX_SEARCH_LENGTH));
      setSelectedFood(null);
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
      autocomplete.fetchAutocomplete(val);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = query.trim();
      if (trimmed.length === 0 || trimmed.length < 2) {
        setEmptySubmitMessage(true);
        setTimeout(() => setEmptySubmitMessage(false), 3000);
      }
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion);
    autocomplete.setShowDropdown(false);
    autocomplete.setSuggestions([]);
    await autocomplete.fetchAutocomplete(suggestion, 0);
  };

  const handleLoadMore = async () => {
    if (!autocomplete.currentQuery || autocomplete.isLoadingMore) return;
    const nextPage = autocomplete.currentPage + 1;
    await autocomplete.fetchAutocomplete(autocomplete.currentQuery, nextPage);
  };

  const handleFoodSelect = async (food: FoodSearchResult) => {
    autocomplete.setShowDropdown(false);
    setQuery(food.name);
    setIsLoadingDetails(true);
    setSelectedServingIdx(0);
    setQuantity(1);
    setMealSlot('');
    setLoggedDate(getTodayString());
    setLogSuccess(null);
    setLogError(null);

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

  const currentServing: FoodServing | undefined = selectedFood?.servings?.[selectedServingIdx];

  const handleLogFood = async () => {
    if (!selectedFood || !currentServing) return;

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
        toast.success(`${selectedFood.name} logged successfully`);
        setIsLogNetworkError(false);
        lastLogTimestampRef.current = Date.now();
        try {
          window.history.replaceState({ ...window.history.state, foodSearchSubmitted: true }, '');
        } catch (err) {
          console.warn('[useFoodSearch] Failed to update history state:', err);
        }
        setTimeout(() => {
          setSelectedFood(null);
          setQuery('');
          setLogSuccess(null);
          setQuantity(1);
          setMealSlot('');
          setLoggedDate(getTodayString());
          inputRef.current?.focus();
        }, 2500);
      } else {
        setLogError(data.error || 'Failed to log food');
        setIsLogNetworkError(false);
      }
    } catch (err) {
      logger.error('[useFoodSearch] Network error logging food:', err);
      setLogError('Unable to connect. Please check your internet connection and try again.');
      setIsLogNetworkError(true);
    } finally {
      setIsLogging(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedFood(null);
    setLogSuccess(null);
    setLogError(null);
    setIsLogNetworkError(false);
    setQueryTooLong(false);
    setEmptySubmitMessage(false);
    setQuantity(1);
    setMealSlot('');
    setLoggedDate(getTodayString());
    setSelectedServingIdx(0);
    autocomplete.resetAutocomplete();
    inputRef.current?.focus();
  };

  const handleCloseDetails = () => {
    setSelectedFood(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (autocomplete.suggestions.length > 0 || autocomplete.searchResults.length > 0) {
      autocomplete.setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setIsFocused(false), 200);
  };

  return {
    // State
    query,
    suggestions: autocomplete.suggestions,
    searchResults: autocomplete.searchResults,
    selectedFood,
    selectedServingIdx,
    showDropdown: autocomplete.showDropdown,
    isLoading: autocomplete.isLoading,
    isLoadingDetails,
    isLoadingMore: autocomplete.isLoadingMore,
    quantity,
    mealSlot,
    loggedDate,
    isLogging,
    logSuccess,
    logError,
    isLogNetworkError,
    isFocused,
    queryTooLong,
    hasMore: autocomplete.hasMore,
    emptySubmitMessage,
    currentServing,

    // Refs
    inputRef,
    dropdownRef,

    // Setters
    setSelectedServingIdx,
    setQuantity,
    setMealSlot,
    setLoggedDate,

    // Handlers
    handleInputChange,
    handleKeyDown,
    handleSuggestionClick,
    handleLoadMore,
    handleFoodSelect,
    handleLogFood,
    handleClear,
    handleCloseDetails,
    handleFocus,
    handleBlur,
  };
}
