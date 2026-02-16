'use client';

import { useFoodSearch } from './useFoodSearch';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { FoodDetailsPanel } from './FoodDetailsPanel';

export default function FoodSearch() {
  const {
    query,
    suggestions,
    searchResults,
    selectedFood,
    selectedServingIdx,
    showDropdown,
    isLoading,
    isLoadingDetails,
    isLoadingMore,
    quantity,
    mealSlot,
    loggedDate,
    isLogging,
    logSuccess,
    logError,
    isLogNetworkError,
    isFocused,
    queryTooLong,
    hasMore,
    emptySubmitMessage,
    currentServing,
    inputRef,
    dropdownRef,
    setSelectedServingIdx,
    setQuantity,
    setMealSlot,
    setLoggedDate,
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
  } = useFoodSearch();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <SearchInput
          query={query}
          isLoading={isLoading}
          isFocused={isFocused}
          showDropdown={showDropdown}
          queryTooLong={queryTooLong}
          emptySubmitMessage={emptySubmitMessage}
          suggestionsCount={suggestions.length}
          searchResultsCount={searchResults.length}
          hasSelectedFood={!!selectedFood}
          inputRef={inputRef}
          onInputChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClear={handleClear}
        />

        {/* Autocomplete Dropdown */}
        <SearchResults
          suggestions={suggestions}
          searchResults={searchResults}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          showDropdown={showDropdown}
          dropdownRef={dropdownRef}
          onSuggestionClick={handleSuggestionClick}
          onFoodSelect={handleFoodSelect}
          onLoadMore={handleLoadMore}
        />
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
        <FoodDetailsPanel
          selectedFood={selectedFood}
          currentServing={currentServing}
          selectedServingIdx={selectedServingIdx}
          quantity={quantity}
          mealSlot={mealSlot}
          loggedDate={loggedDate}
          isLogging={isLogging}
          logSuccess={logSuccess}
          logError={logError}
          isLogNetworkError={isLogNetworkError}
          onServingChange={setSelectedServingIdx}
          onQuantityChange={setQuantity}
          onMealSlotChange={setMealSlot}
          onDateChange={setLoggedDate}
          onLogFood={handleLogFood}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  );
}
