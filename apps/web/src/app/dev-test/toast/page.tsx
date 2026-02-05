'use client';

import { notFound } from 'next/navigation';
import { toast } from '@/lib/toast-store';

export default function ToastTestPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const triggerError = () => {
    toast.error('Something went wrong! Please try again.');
  };

  const triggerSuccess = () => {
    toast.success('Operation completed successfully!');
  };

  const triggerWarning = () => {
    toast.warning('Your session is about to expire.');
  };

  const triggerInfo = () => {
    toast.info('Your meal plan is being generated...');
  };

  const triggerFailedApiCall = async () => {
    try {
      const res = await fetch('/api/dev-test/toast-test', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `Server error (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete operation');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[#fafafa]">Toast Notification Test</h1>
        <p className="text-sm text-[#a1a1aa]">
          Click the buttons below to trigger toast notifications.
        </p>

        <div className="space-y-3">
          <button
            onClick={triggerError}
            data-testid="trigger-error-toast"
            className="w-full px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-bold hover:bg-red-500/30 transition-colors"
          >
            Trigger Error Toast
          </button>

          <button
            onClick={triggerSuccess}
            data-testid="trigger-success-toast"
            className="w-full px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 font-bold hover:bg-green-500/30 transition-colors"
          >
            Trigger Success Toast
          </button>

          <button
            onClick={triggerWarning}
            data-testid="trigger-warning-toast"
            className="w-full px-4 py-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 font-bold hover:bg-yellow-500/30 transition-colors"
          >
            Trigger Warning Toast
          </button>

          <button
            onClick={triggerInfo}
            data-testid="trigger-info-toast"
            className="w-full px-4 py-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 font-bold hover:bg-blue-500/30 transition-colors"
          >
            Trigger Info Toast
          </button>

          <hr className="border-[#333]" />

          <button
            onClick={triggerFailedApiCall}
            data-testid="trigger-failed-api"
            className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#f97316] rounded-lg text-[#f97316] font-bold hover:bg-[#f97316]/10 transition-colors"
          >
            Trigger Failed API Call (real 500 error)
          </button>
        </div>
      </div>
    </div>
  );
}
