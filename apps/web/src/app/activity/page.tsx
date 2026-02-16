import type { Metadata } from 'next';
import ActivityLog from '@/components/fitness/ActivityLog';
import FitnessConnections from '@/components/fitness/FitnessConnections';
import NavBar from '@/components/navigation/NavBar';

export const metadata: Metadata = {
  title: 'Activity',
  robots: { index: false, follow: false },
};

export default function ActivityPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-background text-foreground">
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-heading uppercase tracking-wider">
                <span className="text-primary">///</span> Activity & Adjustments
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect fitness trackers and view synced activity data with automatic calorie
                adjustments
              </p>
            </div>

            {/* Fitness Connections Component */}
            <FitnessConnections />

            {/* Activity Log Component */}
            <ActivityLog />
          </div>
        </div>
      </div>
    </>
  );
}
