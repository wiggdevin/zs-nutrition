function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-card rounded skeleton-shimmer ${className ?? ''}`} />;
}

export function ActivitySkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <SkeletonBlock className="h-9 w-64" />
          <SkeletonBlock className="h-4 w-80 mt-2" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-16 w-full rounded-lg" />
          <SkeletonBlock className="h-16 w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-24 w-full rounded-lg" />
          <SkeletonBlock className="h-24 w-full rounded-lg" />
          <SkeletonBlock className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
