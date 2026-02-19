// ============================================================
// Fitness Platform Connections Component
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { logger } from '@/lib/safe-logger';

interface FitnessConnection {
  platform: string;
  platformUserId?: string;
  lastSyncAt?: string;
  syncFrequency: string;
  settings: string;
  createdAt: string;
}

interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: '🍎',
    description: 'Sync from HealthKit on iOS',
    color: 'bg-black',
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: '🏃',
    description: 'Sync from Google Fit',
    color: 'bg-blue-500',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: '⌚',
    description: 'Sync from Fitbit devices',
    color: 'bg-teal-500',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: '💍',
    description: 'Sync from Oura Ring',
    color: 'bg-indigo-500',
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You denied access to your fitness data. You can try again anytime.',
  token_exchange_failed: 'Failed to connect your account. Please try again.',
  invalid_state: 'Connection expired. Please try connecting again.',
  server_error: 'Something went wrong on our end. Please try again later.',
  missing_credentials: 'This integration is not yet available. Check back soon.',
};

const STALENESS_THRESHOLD_HOURS = 48;

export default function FitnessConnections() {
  const [connections, setConnections] = useState<FitnessConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const searchParams = useSearchParams();

  // Handle OAuth callback query params
  useEffect(() => {
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    const fitness = searchParams.get('fitness');

    if (status === 'connected' && fitness) {
      toast.success(
        `${fitness.charAt(0).toUpperCase() + fitness.slice(1)} connected successfully!`
      );
    } else if (error) {
      toast.error(ERROR_MESSAGES[error] || 'An unexpected error occurred. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fitness/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      logger.error('Error loading fitness connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    try {
      setConnecting(platform);
      const response = await fetch('/api/fitness/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          toast.error(data.error || 'This integration is not yet available.');
        } else {
          toast.error(data.error || 'Failed to initiate connection');
        }
        return;
      }

      if (data.oauthUrl) {
        window.location.href = data.oauthUrl;
      } else {
        toast.error('No OAuth URL returned');
      }
    } catch (error) {
      logger.error('Error connecting platform:', error);
      toast.error('Failed to connect. Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      const response = await fetch('/api/fitness/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success('Platform disconnected successfully');
      loadConnections();
    } catch (error) {
      logger.error('Error disconnecting platform:', error);
      toast.error('Failed to disconnect. Please try again.');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/fitness/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to sync');
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Activity synced successfully');
        loadConnections();
      } else {
        toast.error('Some platforms failed to sync');
      }
    } catch (error) {
      logger.error('Error syncing activity:', error);
      toast.error('Failed to sync activity. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = (platformId: string) => {
    return connections.some((c) => c.platform === platformId);
  };

  const getConnection = (platformId: string) => {
    return connections.find((c) => c.platform === platformId);
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-heading uppercase tracking-wider mb-4">
          <span className="text-primary">{'///'}</span> Fitness Tracker Integration
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
          <span className="text-primary">{'///'}</span> Fitness Tracker Integration
        </h2>
        {connections.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        Connect your fitness tracker or wearable to automatically adjust your daily calorie targets
        based on real activity data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const connection = getConnection(platform.id);

          return (
            <div
              key={platform.id}
              className={`border rounded-lg p-4 transition-all ${
                connected ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center text-2xl`}
                  >
                    {platform.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{platform.name}</h3>
                    <p className="text-xs text-muted-foreground">{platform.description}</p>
                  </div>
                </div>

                {connected ? (
                  <button
                    onClick={() => handleDisconnect(platform.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    disabled={connecting === platform.id}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {connecting === platform.id ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>

              {connected && connection && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Last sync:</span>
                    <span className="text-white">{formatLastSync(connection.lastSyncAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Sync frequency:</span>
                    <span className="text-white capitalize">{connection.syncFrequency}</span>
                  </div>
                  {connection.lastSyncAt &&
                    (() => {
                      const hoursSince =
                        (Date.now() - new Date(connection.lastSyncAt).getTime()) / (1000 * 60 * 60);
                      return hoursSince > STALENESS_THRESHOLD_HOURS ? (
                        <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                          <p className="text-[11px] text-orange-400">
                            Data is stale ({Math.round(hoursSince)}h since last sync). Try syncing
                            manually.
                          </p>
                        </div>
                      ) : null;
                    })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {connections.length === 0 && (
        <div className="mt-6 p-4 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            No fitness trackers connected. Connect one above to enable automatic calorie adjustments
            based on your activity.
          </p>
        </div>
      )}
    </div>
  );
}
