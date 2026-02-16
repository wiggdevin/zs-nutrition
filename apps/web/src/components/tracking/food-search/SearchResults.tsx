'use client';

import type { RefObject } from 'react';
import type { FoodSearchResult } from './types';

interface SearchResultsProps {
  suggestions: string[];
  searchResults: FoodSearchResult[];
  hasMore: boolean;
  isLoadingMore: boolean;
  showDropdown: boolean;
  dropdownRef: RefObject<HTMLDivElement | null>;
  onSuggestionClick: (suggestion: string) => void;
  onFoodSelect: (food: FoodSearchResult) => void;
  onLoadMore: () => void;
}

export function SearchResults({
  suggestions,
  searchResults,
  hasMore,
  isLoadingMore,
  showDropdown,
  dropdownRef,
  onSuggestionClick,
  onFoodSelect,
  onLoadMore,
}: SearchResultsProps) {
  if (!showDropdown || (suggestions.length === 0 && searchResults.length === 0)) {
    return null;
  }

  return (
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
              onClick={() => onSuggestionClick(suggestion)}
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
              onClick={() => onFoodSelect(food)}
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
              onClick={onLoadMore}
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
  );
}
