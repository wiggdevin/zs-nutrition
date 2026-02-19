'use client';

interface TrackingMethodTabsProps {
  activeTab: 'search' | 'manual';
  onTabChange: (tab: 'search' | 'manual') => void;
}

const tabs = [
  { id: 'search' as const, label: 'Search' },
  { id: 'manual' as const, label: 'Manual Entry' },
];

export function TrackingMethodTabs({ activeTab, onTabChange }: TrackingMethodTabsProps) {
  return (
    <div className="mb-4">
      <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
        {'/// Other Methods'}
      </p>
      <div role="tablist" aria-label="Food logging methods" className="flex gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${
                isActive
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
