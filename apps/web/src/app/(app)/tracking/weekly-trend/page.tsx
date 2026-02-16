import NavBar from '@/components/navigation/NavBar';
import WeeklyTrendContent from './WeeklyTrendContent';

export default function WeeklyTrendPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Weekly Trend</h1>
            <p className="text-muted-foreground mb-6">
              7-day overview of your daily nutrition tracking.
            </p>
            <WeeklyTrendContent />
          </div>
        </div>
      </div>
    </>
  );
}
