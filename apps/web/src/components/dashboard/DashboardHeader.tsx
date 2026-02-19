import { PageHeader } from '@/components/ui/PageHeader';
import { ActivitySyncIndicator } from './ActivitySyncStatus';

interface DashboardHeaderProps {
  calorieTarget: number;
}

export function DashboardHeader({ calorieTarget }: DashboardHeaderProps) {
  return (
    <PageHeader
      title="Dashboard"
      showPrefix
      sticky
      maxWidth="screen-2xl"
      actions={
        <>
          <ActivitySyncIndicator />
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
        </>
      }
    />
  );
}
