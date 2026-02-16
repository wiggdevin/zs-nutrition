interface DashboardHeaderProps {
  calorieTarget: number;
}

export function DashboardHeader({ calorieTarget }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-heading uppercase tracking-wide text-foreground">
          <span className="text-primary">///</span> Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Daily Target
            </span>
            <span className="text-lg font-bold font-mono text-primary">
              {calorieTarget.toLocaleString()} kcal
            </span>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-background text-sm font-bold">
            D
          </div>
        </div>
      </div>
    </header>
  );
}
