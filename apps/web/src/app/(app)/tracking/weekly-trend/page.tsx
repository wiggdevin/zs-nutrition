import NavBar from '@/components/navigation/NavBar';
import { PageHeader } from '@/components/ui/PageHeader';
import WeeklyTrendContent from './WeeklyTrendContent';

export default function WeeklyTrendPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <PageHeader
              title="Weekly Trend"
              subtitle="7-day overview of your daily nutrition tracking."
            />
            <WeeklyTrendContent />
          </div>
        </div>
      </div>
    </>
  );
}
