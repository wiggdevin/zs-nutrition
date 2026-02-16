function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-card rounded skeleton-shimmer ${className ?? ''}`} />;
}

export function GenerateSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <SkeletonBlock className="h-9 w-56" />
          <SkeletonBlock className="h-4 w-72 mt-2" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-12 w-full rounded-lg" />
          <SkeletonBlock className="h-12 w-full rounded-lg" />
          <SkeletonBlock className="h-12 w-full rounded-lg" />
          <SkeletonBlock className="h-12 w-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
