'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { toast } from 'sonner'

export function WeightTrackingCard() {
  const [weightKg, setWeightKg] = useState('')
  const [weightLbs, setWeightLbs] = useState('')
  const [notes, setNotes] = useState('')
  const [useLbs, setUseLbs] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: history, refetch: refetchHistory } = api.adaptiveNutrition.getWeightHistory.useQuery(
    { limit: 8 },
    { enabled: true }
  )

  const { data: trend, isLoading: trendLoading } = api.adaptiveNutrition.analyzeWeightTrend.useQuery(undefined, {
    enabled: true,
    refetchInterval: 30000,
  })

  const logWeightMutation = api.adaptiveNutrition.logWeightEntry.useMutation({
    onSuccess: () => {
      toast.success('Weight logged successfully')
      setWeightKg('')
      setWeightLbs('')
      setNotes('')
      refetchHistory()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to log weight')
    },
  })

  const handleWeightChange = (value: string) => {
    if (useLbs) {
      setWeightLbs(value)
      // Convert to kg
      const lbs = parseFloat(value)
      if (!isNaN(lbs)) {
        setWeightKg((lbs / 2.20462).toFixed(1))
      } else {
        setWeightKg('')
      }
    } else {
      setWeightKg(value)
      // Convert to lbs
      const kg = parseFloat(value)
      if (!isNaN(kg)) {
        setWeightLbs((kg * 2.20462).toFixed(1))
      } else {
        setWeightLbs('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const weight = useLbs ? parseFloat(weightLbs) : parseFloat(weightKg)
    if (isNaN(weight) || weight < 30 || weight > 300) {
      toast.error('Please enter a valid weight')
      return
    }

    setIsSubmitting(true)
    try {
      await logWeightMutation.mutateAsync({
        weightKg: useLbs ? parseFloat(weightKg) : weight,
        notes: notes.trim() || undefined,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const latestEntry = history?.entries?.[0]
  const previousEntry = history?.entries?.[1]

  const weeklyChange =
    latestEntry && previousEntry
      ? {
          kg: Math.round((latestEntry.weightKg - previousEntry.weightKg) * 10) / 10,
          lbs: Math.round((latestEntry.weightLbs - previousEntry.weightLbs) * 10) / 10,
        }
      : null

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Log Weight Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Log Weekly Weight
          </CardTitle>
          <CardDescription>Track your progress for adaptive calorie adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={!useLbs ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUseLbs(false)
                  handleWeightChange(weightKg)
                }}
              >
                kg
              </Button>
              <Button
                type="button"
                variant={useLbs ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUseLbs(true)
                  handleWeightChange(weightLbs)
                }}
              >
                lbs
              </Button>
            </div>

            <div>
              <Label htmlFor="weight">Weight ({useLbs ? 'lbs' : 'kg'})</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder={useLbs ? '150' : '68'}
                value={useLbs ? weightLbs : weightKg}
                onChange={(e) => handleWeightChange(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., Fasted weight in the morning"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
              Log Weight
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Weight History & Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {weeklyChange?.lbs ? (
              weeklyChange.lbs < 0 ? (
                <TrendingDown className="h-5 w-5 text-green-600" />
              ) : weeklyChange.lbs > 0 ? (
                <TrendingUp className="h-5 w-5 text-blue-600" />
              ) : (
                <Minus className="h-5 w-5 text-gray-400" />
              )
            ) : (
              <Minus className="h-5 w-5 text-gray-400" />
            )}
            Weight History
          </CardTitle>
          <CardDescription>Your recent weight entries and trends</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !trend?.hasEnoughData ? (
            <Alert>
              <AlertDescription>{trend?.message || 'Log at least 2 weights to see trends'}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {/* Current Weight */}
              {latestEntry && (
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Latest Weight</p>
                    <p className="text-2xl font-bold">
                      {latestEntry.weightLbs} lbs
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({latestEntry.weightKg} kg)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(latestEntry.logDate).toLocaleDateString()}
                    </p>
                  </div>

                  {weeklyChange && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">vs Last Entry</p>
                      <p
                        className={`text-lg font-semibold ${
                          weeklyChange.lbs < 0
                            ? 'text-green-600'
                            : weeklyChange.lbs > 0
                            ? 'text-blue-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {weeklyChange.lbs < 0 ? '-' : weeklyChange.lbs > 0 ? '+' : ''}
                        {Math.abs(weeklyChange.lbs)} lbs
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Trend Summary */}
              {trend?.hasEnoughData && trend.overallTrend && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall Change:</span>
                    <span className="font-medium">
                      {trend.overallTrend.weightChangeLbs > 0 ? '+' : ''}
                      {trend.overallTrend.weightChangeLbs} lbs
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weekly Rate:</span>
                    <span className="font-medium">{trend.overallTrend.weeklyRateLbs} lbs/week</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tracking Period:</span>
                    <span className="font-medium">{trend.overallTrend.timeSpanDays} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">On Track:</span>
                    <span className={`font-medium ${trend.isOnTrack ? 'text-green-600' : 'text-orange-600'}`}>
                      {trend.isOnTrack ? 'Yes ✓' : 'Not quite'}
                    </span>
                  </div>
                </div>
              )}

              {/* Milestones */}
              {trend?.milestones && trend.milestones.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <p className="font-medium mb-1">Milestones Achieved:</p>
                    <ul className="list-disc list-inside text-sm">
                      {trend.milestones.map((milestone, i) => (
                        <li key={i}>{milestone}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Recent Entries List */}
              {history && history.entries.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Recent Entries:</p>
                  <div className="space-y-1">
                    {history.entries.slice(1).map((entry) => (
                      <div key={entry.id} className="flex justify-between text-sm py-1 border-b">
                        <span>{entry.weightLbs} lbs</span>
                        <span className="text-muted-foreground">{new Date(entry.logDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
