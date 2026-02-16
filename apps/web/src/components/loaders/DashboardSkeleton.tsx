function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-card rounded skeleton-shimmer ${className ?? ''}`} />;
}

function MacroRingSkeleton({ size = 120 }: { size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-testid="macro-ring-skeleton"
      aria-hidden="true"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.7}
            className="skeleton-shimmer"
            style={{
              background:
                'linear-gradient(90deg, var(--card) 0%, var(--border) 50%, var(--card) 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <SkeletonBlock className="h-5 w-10" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

function MealCardSkeleton() {
  return (
    <div
      className="flex items-center justify-between p-4 card-elevation border border-border rounded-xl"
      data-testid="meal-card-skeleton"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-4 w-40" />
        <div className="flex gap-3 mt-2">
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <SkeletonBlock className="h-4 w-10" />
        <SkeletonBlock className="h-8 w-14 rounded-lg" />
      </div>
    </div>
  );
}

function LogEntrySkeleton() {
  return (
    <div
      className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
      data-testid="log-entry-skeleton"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-14 rounded-full" />
        </div>
        <SkeletonBlock className="h-3 w-44" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen bg-background"
      data-testid="dashboard-skeleton"
      role="status"
      aria-label="Loading dashboard"
    >
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary text-2xl font-heading">{'///'}</span>
            <SkeletonBlock className="h-7 w-32" />
          </div>
          <SkeletonBlock className="h-10 w-10 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        {/* Page Title Skeleton */}
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>

        {/* MACRO RINGS SKELETON */}
        <section
          data-testid="macro-rings-skeleton"
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <SkeletonBlock className="h-3 w-24" />
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-6 w-32 rounded-full" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 md:gap-8 justify-items-center">
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
            <MacroRingSkeleton size={120} />
          </div>
          <div className="mt-6 flex justify-center">
            <SkeletonBlock className="h-4 w-52" />
          </div>
        </section>

        {/* ADHERENCE SCORE SKELETON */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <SkeletonBlock className="h-3 w-32 mb-4" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-12 w-16" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-8 w-12" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex-1 space-y-1">
              <SkeletonBlock className="h-3 w-full rounded-full" />
              <SkeletonBlock className="h-2 w-24" />
            </div>
          </div>
        </section>

        {/* Two-column layout for Plan + Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TODAY'S PLAN SKELETON */}
          <section
            data-testid="todays-plan-skeleton"
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <div className="space-y-3">
              <MealCardSkeleton />
              <MealCardSkeleton />
              <MealCardSkeleton />
            </div>
          </section>

          {/* TODAY'S LOG SKELETON */}
          <section
            data-testid="todays-log-skeleton"
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <div>
              <LogEntrySkeleton />
              <LogEntrySkeleton />
              <LogEntrySkeleton />
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-center">
              <SkeletonBlock className="h-3 w-64" />
            </div>
          </section>
        </div>

        {/* QUICK ACTIONS SKELETON */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <SkeletonBlock className="h-3 w-28 mb-4" />
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-12 w-36 rounded-xl" />
            <SkeletonBlock className="h-12 w-32 rounded-xl" />
            <SkeletonBlock className="h-12 w-28 rounded-xl" />
          </div>
        </section>
      </main>
    </div>
  );
}
