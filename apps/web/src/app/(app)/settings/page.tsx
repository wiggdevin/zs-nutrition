import type { Metadata } from 'next';
import { Suspense } from 'react';
import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import SettingsDemographics from '@/components/settings/SettingsDemographics';
import SettingsGoals from '@/components/settings/SettingsGoals';
import SettingsDietary from '@/components/settings/SettingsDietary';
import SettingsActivity from '@/components/settings/SettingsActivity';
import SettingsMealStructure from '@/components/settings/SettingsMealStructure';
import SettingsPlanHistory from '@/components/settings/SettingsPlanHistory';
import SettingsAccountConsolidated from '@/components/settings/SettingsAccountConsolidated';
import { SettingsSkeleton } from '@/components/loaders/SettingsSkeleton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
      <span className="text-primary">{'///'}</span> {children}
    </h2>
  );
}

function AccordionSectionTitle({ title }: { title: string }) {
  return (
    <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
      <span className="text-primary">{'///'}</span> {title}
    </span>
  );
}

export default function SettingsPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <Suspense fallback={<SettingsSkeleton />}>
          <PageHeader
            title="Settings"
            showPrefix
            sticky
            maxWidth="screen-2xl"
            subtitle="Manage your profile and preferences"
          />
          <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
              {/* Group 1: Profile & Preferences */}
              <section>
                <div className="mb-4">
                  <SectionLabel>Profile & Preferences</SectionLabel>
                </div>
                <Accordion type="multiple" defaultValue={['demographics']}>
                  <div className="space-y-3">
                    <AccordionItem value="demographics">
                      <AccordionTrigger>
                        <AccordionSectionTitle title="Demographics" />
                      </AccordionTrigger>
                      <AccordionContent>
                        <SettingsDemographics />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="goals">
                      <AccordionTrigger>
                        <AccordionSectionTitle title="Goals" />
                      </AccordionTrigger>
                      <AccordionContent>
                        <SettingsGoals />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="dietary">
                      <AccordionTrigger>
                        <AccordionSectionTitle title="Dietary Preferences" />
                      </AccordionTrigger>
                      <AccordionContent>
                        <SettingsDietary />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="activity">
                      <AccordionTrigger>
                        <AccordionSectionTitle title="Activity & Training" />
                      </AccordionTrigger>
                      <AccordionContent>
                        <SettingsActivity />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="meal-structure">
                      <AccordionTrigger>
                        <AccordionSectionTitle title="Meal Structure" />
                      </AccordionTrigger>
                      <AccordionContent>
                        <SettingsMealStructure />
                      </AccordionContent>
                    </AccordionItem>
                  </div>
                </Accordion>
              </section>

              {/* Group 2: Plan History */}
              <section>
                <SettingsPlanHistory />
              </section>

              {/* Group 3: Account & Security */}
              <section>
                <div className="mb-4">
                  <SectionLabel>Account & Security</SectionLabel>
                </div>
                <SettingsAccountConsolidated />
              </section>
            </div>
          </div>
        </Suspense>
      </div>
    </>
  );
}
