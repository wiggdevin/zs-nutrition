// ============================================================
// Activity Log View Component
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/safe-logger';

interface ActivityData {
  date: string;
  baseTarget: number;
  adjustedTarget: number;
  adjustment: number;
  reason: string;
  activities: Activity[];
  totalActiveCalories: number;
  totalWorkouts: number;
  totalActiveMinutes: number;
}

interface Activity {
  platform: string;
  steps?: number;
  activeCalories?: number;
  totalCalories?: number;
  distanceKm?: number;
  distanceMiles?: number;
  activeMinutes?: number;
  workoutCount?: number;
  workouts: Workout[];
  sleepMinutes?: number;
  sleepScore?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  syncedAt: string;
}

interface Workout {
  type: string;
  startTime: string;
  durationMinutes: number;
  caloriesBurned: number;
}

interface Workout {
  type: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  caloriesBurned: number;
  distanceKm?: number;
}

const PLATFORM_ICONS: Record<string, string> = {
  apple_health: '🍎',
  google_fit: '🏃',
  fitbit: '⌚',
  oura: '💍',
};

const WORKOUT_TYPE_ICONS: Record<string, string> = {
  walking: '🚶',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  strength_training: '🏋️',
  hiit: '⚡',
  yoga: '🧘',
  crossfit: '🏆',
  other: '💪',
};

export default function ActivityLog() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivityData();
  }, [selectedDate]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fitness/activity?date=${selectedDate}`);

      if (response.ok) {
        const data = await response.json();
        setActivityData(data);
      } else {
        setActivityData(null);
      }
    } catch (error) {
      logger.error('Error loading activity data:', error);
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatSyncTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatNumber = (num?: number | null) => {
    return num?.toLocaleString() || '0';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-heading uppercase tracking-wider mb-4">
          <span className="text-primary">{'///'}</span> Activity Log
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading uppercase tracking-wider">
          <span className="text-primary">{'///'}</span> Activity Log
        </h2>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      {!activityData ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No activity data available for {formatDate(selectedDate)}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Calorie Adjustment Summary */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Calorie Target Adjustment</h3>
                <p className="text-sm text-muted-foreground">{formatDate(selectedDate)}</p>
              </div>
              {activityData.adjustment > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">+{activityData.adjustment}</div>
                  <div className="text-xs text-muted-foreground">calories</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Base Target</div>
                <div className="text-lg font-semibold text-white">{activityData.baseTarget}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Adjusted Target</div>
                <div className="text-lg font-semibold text-primary">
                  {activityData.adjustedTarget}
                </div>
              </div>
            </div>

            {activityData.reason && (
              <div className="pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground">{activityData.reason}</p>
              </div>
            )}
          </div>

          {/* Activity Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl mb-1">👟</div>
              <div className="text-xs text-muted-foreground mb-1">Steps</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(
                  activityData.totalActiveCalories > 0
                    ? activityData.activities.find((a) => a.steps)?.steps
                    : 0
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl mb-1">🔥</div>
              <div className="text-xs text-muted-foreground mb-1">Active Calories</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(activityData.totalActiveCalories)}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl mb-1">💪</div>
              <div className="text-xs text-muted-foreground mb-1">Workouts</div>
              <div className="text-lg font-semibold text-white">{activityData.totalWorkouts}</div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-2xl mb-1">⏱️</div>
              <div className="text-xs text-muted-foreground mb-1">Active Minutes</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(activityData.totalActiveMinutes)}
              </div>
            </div>
          </div>

          {/* Platform-Specific Data */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Synced Data</h3>
            <div className="space-y-3">
              {activityData.activities.map((activity, index) => (
                <div key={index} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{PLATFORM_ICONS[activity.platform] || '📊'}</div>
                      <div>
                        <div className="font-semibold text-white capitalize">
                          {activity.platform.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Synced at {formatSyncTime(activity.syncedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {activity.steps !== undefined && activity.steps !== null && (
                      <div>
                        <span className="text-muted-foreground">Steps:</span>{' '}
                        <span className="text-white">{formatNumber(activity.steps)}</span>
                      </div>
                    )}
                    {activity.activeCalories !== undefined && activity.activeCalories !== null && (
                      <div>
                        <span className="text-muted-foreground">Active Cals:</span>{' '}
                        <span className="text-white">{formatNumber(activity.activeCalories)}</span>
                      </div>
                    )}
                    {activity.distanceKm !== undefined && activity.distanceKm !== null && (
                      <div>
                        <span className="text-muted-foreground">Distance:</span>{' '}
                        <span className="text-white">{activity.distanceKm.toFixed(1)} km</span>
                      </div>
                    )}
                    {activity.sleepScore !== undefined && activity.sleepScore !== null && (
                      <div>
                        <span className="text-muted-foreground">Sleep Score:</span>{' '}
                        <span className="text-white">{activity.sleepScore}/100</span>
                      </div>
                    )}
                  </div>

                  {/* Workouts */}
                  {activity.workouts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-2">Workouts:</div>
                      <div className="space-y-2">
                        {activity.workouts.map((workout, wIndex) => (
                          <div key={wIndex} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{WORKOUT_TYPE_ICONS[workout.type] || '💪'}</span>
                              <span className="text-white capitalize">
                                {workout.type.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              {workout.durationMinutes} min • {workout.caloriesBurned} cal
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
