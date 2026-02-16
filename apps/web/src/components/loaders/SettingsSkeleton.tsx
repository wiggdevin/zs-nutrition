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

        {/* Settings Sections */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <SkeletonBlock className="h-5 w-32" />
            <div className="space-y-3">
              <SkeletonBlock className="h-10 w-full rounded-lg" />
              <SkeletonBlock className="h-10 w-full rounded-lg" />
              <SkeletonBlock className="h-10 w-3/4 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
