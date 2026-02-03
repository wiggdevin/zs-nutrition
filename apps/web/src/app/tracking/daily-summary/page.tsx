'use client'

import NavBar from '@/components/navigation/NavBar'
import { DailySummaryContent } from './DailySummaryContent'

export default function DailySummaryPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Daily Summary</h1>
            <p className="text-[#a1a1aa] mb-6">
              Today&apos;s tracking data from <code className="text-orange-400">tracking.getDailySummary</code>
            </p>
            <DailySummaryContent />
          </div>
        </div>
      </div>
    </>
  )
}
