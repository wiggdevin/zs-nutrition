'use client';

import type { RefObject } from 'react';
import { MAX_SEARCH_LENGTH } from './types';

interface SearchInputProps {
  query: string;
  isLoading: boolean;
  isFocused: boolean;
  showDropdown: boolean;
  queryTooLong: boolean;
  emptySubmitMessage: boolean;
  suggestionsCount: number;
  searchResultsCount: number;
  hasSelectedFood: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
}

export function SearchInput({
  query,
  isLoading,
  isFocused,
  showDropdown,
  queryTooLong,
  emptySubmitMessage,
  suggestionsCount,
  searchResultsCount,
  hasSelectedFood,
  inputRef,
  onInputChange,
  onKeyDown,
  onFocus,
  onBlur,
  onClear,
}: SearchInputProps) {
  return (
    <>
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
          aria-expanded={showDropdown && (suggestionsCount > 0 || searchResultsCount > 0)}
          aria-controls="food-search-listbox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
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
            onClick={onClear}
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
          searchResultsCount > 0 &&
          `${searchResultsCount} food results found`}
        {!isLoading &&
          showDropdown &&
          searchResultsCount === 0 &&
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
            Search query is too long (max {MAX_SEARCH_LENGTH} characters). Input has been truncated.
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
      {isFocused && query.trim().length < 2 && !showDropdown && !hasSelectedFood && !isLoading && (
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
        suggestionsCount === 0 &&
        searchResultsCount === 0 &&
        query.trim().length >= 2 &&
        !hasSelectedFood && (
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
                No foods matched &ldquo;{query.trim()}&rdquo;.
                {query.trim().length < 5 &&
                  ' Try typing the full name (e.g. "Chicken" instead of "Chi").'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Try a different spelling or a more common food name
              </p>
            </div>
          </div>
        )}
    </>
  );
}
