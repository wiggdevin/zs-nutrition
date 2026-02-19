import { QuickAction } from './QuickAction';

export function QuickActionsSection() {
  return (
    <section
      data-testid="quick-actions-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-4">
        {'/// Quick Actions'}
      </p>
      <div className="flex flex-wrap gap-3">
        <QuickAction icon="📸" label="Scan Meal" href="/tracking?mode=scan" variant="primary" />
        <QuickAction icon="📋" label="Log from Plan" href="/dashboard#todays-plan" />
        <QuickAction icon="🔍" label="Search Food" href="/tracking?mode=search" />
        <QuickAction icon="⚡" label="Quick Add" href="/tracking?mode=quick" />
      </div>
    </section>
  );
}
