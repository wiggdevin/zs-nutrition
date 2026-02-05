'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function AdaptiveCalorieCard() {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingKcal, setPendingKcal] = useState<number | null>(null)

  const { data: suggestion, isLoading, refetch } = trpc.adaptiveNutrition.suggestCalorieAdjustment.useQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 60000, // Check every minute
    }
  )

  const applyAdjustmentMutation = trpc.adaptiveNutrition.applyCalorieAdjustment.useMutation({
    onSuccess: () => {
      toast.success('Calorie targets updated successfully')
      setShowConfirmDialog(false)
      setPendingKcal(null)
      refetch()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to apply adjustment')
    },
  })

  const handleApplyAdjustment = () => {
    if (!suggestion?.hasSuggestion || !suggestion.suggestedGoalKcal) return

    setPendingKcal(suggestion.suggestedGoalKcal)
    setShowConfirmDialog(true)
  }

  const confirmAdjustment = () => {
    if (!pendingKcal) return

    applyAdjustmentMutation.mutate({
      newGoalKcal: pendingKcal,
      confirmed: true,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!suggestion?.hasSuggestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Adaptive Calories
          </CardTitle>
          <CardDescription>Your calorie targets are optimized for your current progress</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Current Target: {suggestion?.currentGoalKcal} calories/day</p>
                <p className="text-sm text-muted-foreground">
                  Keep logging your weight weekly. The system will automatically suggest adjustments if your
                  progress deviates from your goal rate.
                </p>
                {suggestion?.trendData && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Current rate: {suggestion.trendData.weeklyRateLbs} lbs/week over{' '}
                    {suggestion.trendData.timeSpanDays} days
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const isIncrease = (suggestion.calorieDifference ?? 0) > 0
  const difference = Math.abs(suggestion.calorieDifference ?? 0)

  return (
    <>
      <Card className={isIncrease ? 'border-blue-200 bg-blue-50/50' : 'border-primary/30 bg-primary/5'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isIncrease ? (
              <TrendingUp className="h-5 w-5 text-blue-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-primary/90" />
            )}
            Adaptive Calorie Suggestion
          </CardTitle>
          <CardDescription>
            {isIncrease
              ? 'Consider increasing calories to optimize progress'
              : 'Consider decreasing calories to get back on track'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Adjustment Summary */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="mb-2">Recommended Adjustment</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{suggestion.currentGoalKcal}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`text-2xl font-bold ${isIncrease ? 'text-blue-600' : 'text-primary/90'}`}>
                      {suggestion.suggestedGoalKcal}
                    </span>
                    <span className="text-sm text-muted-foreground">calories/day</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isIncrease ? (
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-primary/90 rotate-180" />
                    )}
                    <span className={`font-medium ${isIncrease ? 'text-blue-600' : 'text-primary/90'}`}>
                      {isIncrease ? '+' : '-'}
                      {difference} calories/day
                    </span>
                  </div>

                  <p className="text-sm mt-2">{suggestion.adjustmentReason}</p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Trend Context */}
            {suggestion.trendData && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Progress Analysis:</p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>Weekly Rate: {suggestion.trendData.weeklyRateLbs} lbs/week</div>
                  <div>Total Change: {suggestion.trendData.weightChangeLbs} lbs</div>
                  <div>Tracking Period: {suggestion.trendData.timeSpanDays} days</div>
                </div>
              </div>
            )}

            {/* Safe Bounds Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <p className="font-medium mb-1">Safe Bounds:</p>
                <p>
                  Your calories will stay within a healthy range ({suggestion.safeBounds?.min} -{' '}
                  {suggestion.safeBounds?.max}) based on your BMR of {(suggestion.currentGoalKcal ?? 0) - 200}.
                </p>
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleApplyAdjustment}
                className={isIncrease ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/80'}
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
              <Button variant="outline" onClick={() => refetch()}>
                Refresh Analysis
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Applying this adjustment will update your daily calorie targets and macro goals. Your meal plan
              can be regenerated with the new targets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Calorie Adjustment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to adjust your daily calorie target from{' '}
              <strong>{suggestion.currentGoalKcal}</strong> to <strong>{pendingKcal}</strong> calories?
              <br />
              <br />
              This will update your macro targets accordingly. You can regenerate your meal plan with the new
              targets after this adjustment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdjustment}>Confirm Adjustment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
