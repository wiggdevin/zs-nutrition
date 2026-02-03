'use client'

import { toast } from '@/lib/toast-store'

export default function TestToastPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <h1 className="text-2xl font-bold text-[#fafafa] mb-6">Toast Notification Test</h1>
      <div className="flex flex-col gap-4 max-w-xs">
        <button
          data-testid="trigger-success-toast"
          onClick={() => toast.success('Settings saved successfully!')}
          className="rounded-lg bg-green-600 px-4 py-3 text-white font-bold uppercase tracking-wide hover:bg-green-700 transition-colors"
        >
          Success Toast
        </button>
        <button
          data-testid="trigger-error-toast"
          onClick={() => toast.error('Something went wrong!')}
          className="rounded-lg bg-red-600 px-4 py-3 text-white font-bold uppercase tracking-wide hover:bg-red-700 transition-colors"
        >
          Error Toast
        </button>
        <button
          data-testid="trigger-info-toast"
          onClick={() => toast.info('Here is some useful info.')}
          className="rounded-lg bg-blue-600 px-4 py-3 text-white font-bold uppercase tracking-wide hover:bg-blue-700 transition-colors"
        >
          Info Toast
        </button>
        <button
          data-testid="trigger-warning-toast"
          onClick={() => toast.warning('Watch out! This is a warning.')}
          className="rounded-lg bg-yellow-600 px-4 py-3 text-white font-bold uppercase tracking-wide hover:bg-yellow-700 transition-colors"
        >
          Warning Toast
        </button>
      </div>
    </div>
  )
}
