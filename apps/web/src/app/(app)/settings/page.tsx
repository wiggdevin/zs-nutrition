import type { Metadata } from 'next';
import { Suspense } from 'react';
import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import SettingsDemographics from '@/components/settings/SettingsDemographics';
import SettingsGoals from '@/components/settings/SettingsGoals';
import SettingsDietary from '@/components/settings/SettingsDietary';
import SettingsActivity from '@/components/settings/SettingsActivity';
import SettingsMealStructure from '@/components/settings/SettingsMealStructure';
import SettingsAccount from '@/components/settings/SettingsAccount';
import SettingsPlanHistory from '@/components/settings/SettingsPlanHistory';
import FitnessConnections from '@/components/fitness/FitnessConnections';
import { SettingsSkeleton } from '@/components/loaders/SettingsSkeleton';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <Suspense fallback={<SettingsSkeleton />}>
          <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
              <PageHeader
                title="Settings"
                showPrefix
                subtitle="Manage your profile and preferences"
              />

              {/* Demographics Section (name, sex, age, height, weight) */}
              <SettingsDemographics />

              {/* Goals Section (goalType, goalRate) */}
              <SettingsGoals />

              {/* Dietary Preferences Section */}
              <SettingsDietary />

              {/* Activity and Training Section */}
              <SettingsActivity />

              {/* Fitness Tracker Integration */}
              <FitnessConnections />

              {/* Meal Structure Section */}
              <SettingsMealStructure />

              {/* Plan History Section */}
              <SettingsPlanHistory />

              {/* Sign Out and Account Deactivation */}
              <SettingsAccount />
            </div>
          </div>
        </Suspense>
      </div>
    </>
  );
}
