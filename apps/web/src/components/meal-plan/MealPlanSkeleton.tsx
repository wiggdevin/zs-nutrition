'use client';

export function MealPlanSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skeleton Header */}
      <div className="border-b border-border bg-background px-4 py-6">
        <div className="mx-auto max-w-[2400px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-40 rounded skeleton-shimmer" />
              <div className="mt-2 h-7 w-56 rounded skeleton-shimmer" />
              <div className="mt-2 h-4 w-48 rounded skeleton-shimmer" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-14 w-20 rounded-lg border border-border bg-card skeleton-shimmer" />
              <div className="h-14 w-20 rounded-lg border border-border bg-card skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton 7-day grid - Responsive layout matching main grid */}
      <div className="mx-auto max-w-[2400px] px-4 md:px-6 xl:px-8 2xl:px-10 py-6">
        <div
          className="
            flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory
            md:grid md:grid-cols-3 md:overflow-x-visible md:pb-0
            lg:grid-cols-4
            xl:grid-cols-5
            2xl:grid-cols-7
          "
          data-testid="meal-plan-skeleton-grid"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => (
            <div key={dayNum} className="min-w-[280px] snap-start md:min-w-0">
              <div
                className="flex flex-col rounded-lg border border-border bg-card overflow-hidden"
                data-testid={`skeleton-day-${dayNum}`}
              >
                {/* Skeleton day header */}
                <div className="border-b border-border bg-gradient-to-b from-card to-card px-4 py-4 text-center">
                  <div className="mx-auto h-5 w-24 rounded skeleton-shimmer" />
                  <div className="mx-auto mt-2 h-3.5 w-28 rounded skeleton-shimmer" />
                </div>

                {/* Skeleton day macro summary */}
                <div className="border-b border-border bg-background px-4 py-3 shadow-inner">
                  <div className="mx-auto h-5 w-20 rounded skeleton-shimmer" />
                  <div className="mt-1.5 flex justify-center gap-3">
                    <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                  </div>
                </div>

                {/* Skeleton meal cards */}
                <div className="flex-1 space-y-2.5 p-2.5">
                  {[1, 2, 3, 4].map((mealNum) => (
                    <div
                      key={mealNum}
                      className="rounded-lg border border-border bg-background p-3"
                      data-testid={`skeleton-meal-card-${dayNum}-${mealNum}`}
                    >
                      {/* Slot label + confidence badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4.5 w-16 rounded-md skeleton-shimmer" />
                        <div className="h-3.5 w-14 rounded-md skeleton-shimmer" />
                      </div>
                      {/* Meal name */}
                      <div className="h-4 w-3/4 rounded skeleton-shimmer mt-1" />
                      {/* Prep time */}
                      <div className="h-3 w-1/2 rounded skeleton-shimmer mt-2" />
                      {/* Macro pills */}
                      <div className="mt-2.5 flex gap-1.5">
                        <div className="h-5 w-14 rounded-full skeleton-shimmer" />
                        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
