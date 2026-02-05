'use client'

import { notFound } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useState } from 'react'

export default function TestFeature150Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [jobId, setJobId] = useState('')

  // Use tRPC query hook to fetch job status
  const { data: jobStatus, isLoading, error, refetch } = trpc.plan.getJobStatus.useQuery(
    { jobId },
    {
      enabled: !!jobId, // Only run query when jobId is not empty
    }
  )

  const testGetJobStatus = () => {
    refetch()
  }

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature #150: getJobStatus Test</h1>
        <p className="text-gray-400 mb-8">Testing planRouter.getJobStatus functionality</p>

        {/* Test Configuration */}
        <div className="bg-card rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Job ID</label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="Enter a plan generation job ID"
                className="w-full bg-background border border-border rounded px-4 py-2 text-white"
              />
            </div>
            <button
              onClick={testGetJobStatus}
              disabled={isLoading || !jobId}
              className="bg-primary hover:bg-primary/90 disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
            >
              {isLoading ? 'Fetching...' : 'Fetch Job Status'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <h3 className="text-red-400 font-semibold mb-2">Error</h3>
            <p className="text-red-300">{error.message}</p>
          </div>
        )}

        {/* Job Status Display */}
        {jobStatus && (
          <div className="bg-card rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Job Status Result</h2>
            <div className="space-y-4">
              {/* Status Field */}
              <div className="flex items-center justify-between p-4 bg-background rounded">
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="text-lg font-semibold">{jobStatus.status}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  jobStatus.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  jobStatus.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                  jobStatus.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {jobStatus.status}
                </div>
              </div>

              {/* Current Agent Field */}
              <div className="flex items-center justify-between p-4 bg-background rounded">
                <div>
                  <p className="text-sm text-gray-400">Current Agent</p>
                  <p className="text-lg font-semibold">
                    {jobStatus.currentAgent ? `Agent ${jobStatus.currentAgent}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Progress Field */}
              {jobStatus.progress && (
                <div className="p-4 bg-background rounded">
                  <p className="text-sm text-gray-400 mb-2">Progress</p>
                  <pre className="text-sm text-gray-300 overflow-x-auto">
                    {JSON.stringify(jobStatus.progress, null, 2)}
                  </pre>
                </div>
              )}

              {/* Plan ID Field (when completed) */}
              {jobStatus.planId && (
                <div className="flex items-center justify-between p-4 bg-background rounded">
                  <div>
                    <p className="text-sm text-gray-400">Plan ID</p>
                    <p className="text-lg font-semibold">{jobStatus.planId}</p>
                  </div>
                </div>
              )}

              {/* Error Field (if failed) */}
              {jobStatus.error && (
                <div className="p-4 bg-red-900/20 rounded">
                  <p className="text-sm text-red-400 mb-2">Error</p>
                  <p className="text-red-300">{jobStatus.error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Checklist */}
        <div className="bg-card rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Verification Checklist</h2>
          <ul className="space-y-2">
            <li className={`flex items-center ${jobStatus?.status ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.status ? '✅' : '○'}</span>
              Status field returns (pending/running/completed/failed)
            </li>
            <li className={`flex items-center ${jobStatus?.currentAgent !== undefined ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.currentAgent !== undefined ? '✅' : '○'}</span>
              currentAgent field present
            </li>
            <li className={`flex items-center ${jobStatus?.progress ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.progress ? '✅' : '○'}</span>
              progress field present
            </li>
            <li className={`flex items-center ${jobStatus?.planId ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.planId ? '✅' : '○'}</span>
              planId present when completed
            </li>
            <li className={`flex items-center ${!error ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{!error ? '✅' : '○'}</span>
              No errors in tRPC call
            </li>
          </ul>
        </div>

        {/* Raw Response */}
        {jobStatus && (
          <div className="bg-card rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Raw Response</h2>
            <pre className="text-sm text-gray-300 overflow-x-auto">
              {JSON.stringify(jobStatus, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
