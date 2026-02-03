'use client'

import { api } from '@/lib/trpc'
import { useState, useEffect } from 'react'

export default function TestFeature150Page() {
  const [jobId, setJobId] = useState('a1e12dd2-081d-4b15-a22b-906fd031d6a9')
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testGetJobStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.plan.getJobStatus.query({ jobId })
      setJobStatus(result)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-test on page load
    testGetJobStatus()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature #150: getJobStatus Test</h1>
        <p className="text-gray-400 mb-8">Testing planRouter.getJobStatus functionality</p>

        {/* Test Configuration */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Job ID</label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-4 py-2 text-white"
              />
            </div>
            <button
              onClick={testGetJobStatus}
              disabled={loading}
              className="bg-[#f97316] hover:bg-[#ea580c] disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
            >
              {loading ? 'Fetching...' : 'Fetch Job Status'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <h3 className="text-red-400 font-semibold mb-2">Error</h3>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Job Status Display */}
        {jobStatus && (
          <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Job Status Result</h2>
            <div className="space-y-4">
              {/* Status Field */}
              <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded">
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
              <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded">
                <div>
                  <p className="text-sm text-gray-400">Current Agent</p>
                  <p className="text-lg font-semibold">
                    {jobStatus.currentAgent ? `Agent ${jobStatus.currentAgent}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Progress Field */}
              <div className="p-4 bg-[#0a0a0a] rounded">
                <p className="text-sm text-gray-400 mb-2">Progress</p>
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(jobStatus.progress, null, 2)}
                </pre>
              </div>

              {/* Plan ID Field (when completed) */}
              {jobStatus.planId && (
                <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded">
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
        <div className="bg-[#1a1a1a] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Verification Checklist</h2>
          <ul className="space-y-2">
            <li className={`flex items-center ${jobStatus?.status ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.status ? '✅' : '○'}</span>
              Status field returns (pending/running/completed/failed)
            </li>
            <li className={`flex items-center ${jobStatus?.currentAgent !== undefined ? 'text-green-400' : 'text-gray-400'}`}>
              <span className="mr-2">{jobStatus?.currentAgent !== undefined ? '✅' : '○'}</span>
              currentAgent field during processing
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
          <div className="bg-[#1a1a1a] rounded-lg p-6 mt-6">
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
