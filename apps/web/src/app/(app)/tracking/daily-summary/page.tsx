'use client';

import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { DailySummaryContent } from './DailySummaryContent';

export default function DailySummaryPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <PageHeader
              title="Daily Summary"
              subtitle={
                <>
                  Today&apos;s tracking data from{' '}
                  <code className="text-primary">tracking.getDailySummary</code>
                </>
              }
            />
            <DailySummaryContent />
          </div>
        </div>
      </div>
    </>
  );
}
