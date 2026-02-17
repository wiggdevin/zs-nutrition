function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-card rounded skeleton-shimmer ${className ?? ''}`} />;
}

export function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div>
          <SkeletonBlock className="h-9 w-48" />
          <SkeletonBlock className="h-4 w-64 mt-2" />
        </div>

        {/* Group 1: Profile & Preferences */}
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-48 mb-2" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6">
              <SkeletonBlock className="h-4 w-36" />
            </div>
          ))}
        </div>

        {/* Group 2: Plan History */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-32" />
          <div className="space-y-3">
            <SkeletonBlock className="h-16 w-full rounded-lg" />
            <SkeletonBlock className="h-16 w-full rounded-lg" />
          </div>
        </div>

        {/* Group 3: Account & Security */}
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-44 mb-2" />
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-24 w-full rounded-lg" />
            <SkeletonBlock className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
