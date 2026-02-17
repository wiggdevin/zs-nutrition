import type { Metadata } from 'next';
import { Suspense } from 'react';
import ActivityLog from '@/components/fitness/ActivityLog';
import FitnessConnections from '@/components/fitness/FitnessConnections';
import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActivitySkeleton } from '@/components/loaders/ActivitySkeleton';

export const metadata: Metadata = {
  title: 'Activity',
  robots: { index: false, follow: false },
};

export default function ActivityPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <Suspense fallback={<ActivitySkeleton />}>
          <PageHeader
            title="Activity & Adjustments"
            showPrefix
            sticky
            maxWidth="screen-2xl"
            subtitle="Connect fitness trackers and view synced activity data with automatic calorie adjustments"
          />
          <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
              {/* Fitness Connections Component */}
              <FitnessConnections />

              {/* Activity Log Component */}
              <ActivityLog />
            </div>
          </div>
        </Suspense>
      </div>
    </>
  );
}
