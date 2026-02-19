'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function AdaptiveCalorieCard() {
  const utils = trpc.useUtils();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingKcal, setPendingKcal] = useState<number | null>(null);

  const {
    data: suggestion,
    isLoading,
    refetch,
  } = trpc.adaptiveNutrition.suggestCalorieAdjustment.useQuery(undefined, {
    enabled: true,
    refetchInterval: 60000,
  });

  const applyAdjustmentMutation = trpc.adaptiveNutrition.applyCalorieAdjustment.useMutation({
    onSuccess: () => {
      toast.success('Calorie targets updated successfully');
      setShowConfirmDialog(false);
      setPendingKcal(null);
      refetch();
      // Invalidate daily targets so all pages update
      utils.user.getDailyTargets.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to apply adjustment');
    },
  });

  const handleApplyAdjustment = () => {
    if (!suggestion?.hasSuggestion || !suggestion.suggestedGoalKcal) return;
    setPendingKcal(suggestion.suggestedGoalKcal);
    setShowConfirmDialog(true);
  };

  const confirmAdjustment = () => {
    if (!pendingKcal) return;
    applyAdjustmentMutation.mutate({
      newGoalKcal: pendingKcal,
      confirmed: true,
    });
  };

  const isIncrease = (suggestion?.calorieDifference ?? 0) > 0;
  const difference = Math.abs(suggestion?.calorieDifference ?? 0);

  return (
    <>
      <section
        className={cn(
          'bg-card border border-border rounded-2xl p-6 space-y-4',
          suggestion?.hasSuggestion &&
            (isIncrease ? 'border-blue-200 bg-blue-50/50' : 'border-primary/30 bg-primary/5')
        )}
      >
        {/* Section label */}
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {'/// Adaptive Calories'}
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Analyzing...</span>
          </div>
        )}

        {/* No suggestion — on track */}
        {!isLoading && !suggestion?.hasSuggestion && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {suggestion?.currentGoalKcal} kcal/day
                <span className="ml-2 text-sm font-normal text-green-600">On track</span>
              </p>
              {suggestion?.trendData && (
                <p className="text-xs text-muted-foreground">
                  Current rate: {suggestion.trendData.weeklyRateLbs} lbs/week over{' '}
                  {suggestion.trendData.timeSpanDays} days
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active suggestion */}
        {!isLoading && suggestion?.hasSuggestion && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isIncrease ? (
                <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-primary/90 flex-shrink-0" />
              )}
              <span className="text-2xl font-bold">{suggestion.currentGoalKcal}</span>
              <span className="text-muted-foreground">→</span>
              <span
                className={cn(
                  'text-2xl font-bold',
                  isIncrease ? 'text-blue-600' : 'text-primary/90'
                )}
              >
                {suggestion.suggestedGoalKcal}
              </span>
              <span className="text-sm text-muted-foreground">kcal/day</span>
              <span
                className={cn(
                  'text-sm font-medium',
                  isIncrease ? 'text-blue-600' : 'text-primary/90'
                )}
              >
                ({isIncrease ? '+' : '-'}
                {difference})
              </span>
            </div>

            <p className="text-sm text-muted-foreground">{suggestion.adjustmentReason}</p>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleApplyAdjustment}
                className={
                  isIncrease ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/80'
                }
                disabled={applyAdjustmentMutation.isPending}
              >
                {applyAdjustmentMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isIncrease ? (
                  <TrendingUp className="mr-2 h-4 w-4" />
                ) : (
                  <TrendingUp className="mr-2 h-4 w-4 rotate-180" />
                )}
                Apply {isIncrease ? 'Increase' : 'Decrease'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* How It Works accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="how-it-works" className="border-0 rounded-none bg-transparent">
            <AccordionTrigger className="px-0 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                How It Works
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="space-y-4">
                {/* Progress Analysis (only when suggestion exists) */}
                {suggestion?.hasSuggestion && suggestion.trendData && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">Progress Analysis:</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>Weekly Rate: {suggestion.trendData.weeklyRateLbs} lbs/week</div>
                      <div>Total Change: {suggestion.trendData.weightChangeLbs} lbs</div>
                      <div>Tracking Period: {suggestion.trendData.timeSpanDays} days</div>
                    </div>
                  </div>
                )}

                {/* Safe Bounds (only when suggestion exists) */}
                {suggestion?.hasSuggestion && suggestion.safeBounds && (
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">Safe Bounds:</p>
                    <p className="text-muted-foreground">
                      Your calories will stay within a healthy range ({suggestion.safeBounds.min} -{' '}
                      {suggestion.safeBounds.max}) based on your BMR of{' '}
                      {(suggestion.currentGoalKcal ?? 0) - 200}.
                    </p>
                  </div>
                )}

                {/* 5-step educational content */}
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">1. Log Weekly:</strong> Record your weight
                    at least once per week, ideally at the same time of day (e.g., Monday mornings,
                    fasted).
                  </p>
                  <p>
                    <strong className="text-foreground">2. Track Progress:</strong> The system
                    analyzes your weight trend and compares it to your goal rate (e.g., 0.5-1
                    lb/week for cutting).
                  </p>
                  <p>
                    <strong className="text-foreground">3. Get Suggestions:</strong> If you deviate
                    from your target rate, the system will suggest calorie adjustments to get you
                    back on track.
                  </p>
                  <p>
                    <strong className="text-foreground">4. Stay Safe:</strong> All adjustments are
                    kept within safe bounds (BMR + 200 to BMR + 1500) to ensure healthy metabolic
                    function.
                  </p>
                  <p>
                    <strong className="text-foreground">5. Prevent Plateaus:</strong> Gradual
                    calorie adjustments help prevent metabolic adaptation and keep progress steady
                    toward your goal.
                  </p>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-muted-foreground">
                  Applying an adjustment will update your daily calorie targets and macro goals.
                  Your meal plan can be regenerated with the new targets.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Calorie Adjustment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to adjust your daily calorie target from{' '}
              <strong>{suggestion?.currentGoalKcal}</strong> to <strong>{pendingKcal}</strong>{' '}
              calories?
              <br />
              <br />
              This will update your macro targets accordingly. You can regenerate your meal plan
              with the new targets after this adjustment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdjustment}>Confirm Adjustment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
