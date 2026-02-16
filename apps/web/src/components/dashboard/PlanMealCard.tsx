import React from 'react';

export interface PlanMealCardProps {
  name: string;
  mealSlot: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: string;
  isLogged: boolean;
  isLogging: boolean;
  onLog: () => void;
}

export const PlanMealCard = React.memo(function PlanMealCard({
  name,
  mealSlot,
  calories,
  protein,
  carbs,
  fat,
  prepTime,
  isLogged,
  isLogging,
  onLog,
}: PlanMealCardProps) {
  return (
    <div className="p-4 card-elevation border border-border rounded-xl hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-1">
            {mealSlot}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:inline">{prepTime}</span>
          {isLogged ? (
            <span className="px-3 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wide bg-success/20 text-success rounded-lg flex items-center gap-1">
              ✓ Logged
            </span>
          ) : (
            <button
              onClick={onLog}
              disabled={isLogging}
              data-testid={`log-btn-${mealSlot.toLowerCase()}`}
              aria-label={`Log ${mealSlot}`}
              className="px-4 py-2 min-h-[44px] min-w-[44px] text-xs font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-background rounded-lg transition-colors"
            >
              {isLogging ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging</span>
                </span>
              ) : (
                'Log'
              )}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
          {calories} kcal
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-chart-3/10 text-chart-3 font-mono">
          P {protein}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-mono">
          C {carbs}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-mono">
          F {fat}g
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground font-mono sm:hidden">
          {prepTime}
        </span>
      </div>
    </div>
  );
});
