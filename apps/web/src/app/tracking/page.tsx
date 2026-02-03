import NavBar from '@/components/navigation/NavBar'
import FoodSearch from '@/components/tracking/FoodSearch'
import ManualEntryForm from '@/components/tracking/ManualEntryForm'
import QuickAddForm from '@/components/tracking/QuickAddForm'

export default function TrackingPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Tracking</h1>
            <p className="text-[#a1a1aa] mb-6">Search and log foods to track your daily macros.</p>
            <FoodSearch />
            <QuickAddForm />
            <div className="mt-4">
              <ManualEntryForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
