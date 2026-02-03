'use client'

import dynamic from 'next/dynamic'

// Dynamic import with SSR disabled to prevent Recharts window/document errors during SSR
const TestChart = dynamic(() => import('@/components/charts/TestChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-[#a1a1aa]">Loading charts...</div>
    </div>
  ),
})

export default function TestChartsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto">
        <TestChart />
      </div>
    </div>
  )
}
