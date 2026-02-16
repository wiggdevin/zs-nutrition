'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/safe-logger';
import type { FoodSearchResult } from './types';

export function useFoodAutocomplete() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);

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

    if (page === 0) {
      setCurrentPage(0);
      setCurrentQuery(trimmed);
    }

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
        const searchRes = await fetch(
          `/api/food-search?q=${encodeURIComponent(q)}&type=search&max=8&page=${page}`,
          { signal: controller.signal }
        );

        if (generation !== searchGenRef.current) return;

        const searchData = await searchRes.json();

        if (generation !== searchGenRef.current) return;

        results = searchData.results || [];
        hasMoreResults = searchData.hasMore || false;

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

  const resetAutocomplete = useCallback(() => {
    setSuggestions([]);
    setSearchResults([]);
    setShowDropdown(false);
    setHasMore(false);
    setCurrentPage(0);
    setCurrentQuery('');
  }, []);

  return {
    suggestions,
    searchResults,
    isLoading,
    isLoadingMore,
    showDropdown,
    currentPage,
    hasMore,
    currentQuery,
    setShowDropdown,
    setSuggestions,
    setSearchResults,
    fetchAutocomplete,
    resetAutocomplete,
  };
}
