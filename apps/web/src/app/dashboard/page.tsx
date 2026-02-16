import type { Metadata } from 'next';
import DashboardClient from '@/components/dashboard/DashboardClient';
import NavBar from '@/components/navigation/NavBar';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <>
      <NavBar />
      <div id="main-content" className="md:pt-14 pb-20 md:pb-0">
        <DashboardClient />
      </div>
    </>
  );
}
