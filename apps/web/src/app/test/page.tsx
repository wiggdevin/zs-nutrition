'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'

interface VerificationResult {
  success: boolean
  jobId?: string
  verification?: {
    jobIdReturned: boolean
    dbRecordCreated: boolean
    dbStatus: string
    bullmqJobId: string
    bullmqEnqueued: boolean
    responseTimeMs: number
    fastResponse: boolean
  }
  error?: string
}

interface JobInfo {
  id: string
  userId: string
  status: string
  createdAt: string
}

export default function TestPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [loading, setLoading] = useState(false)

  async function testGeneratePlan() {
    setLoading(true)
    try {
      const res = await fetch('/api/test-generate', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ success: false, error: String(err) })
    }
    setLoading(false)
  }

  async function fetchJobs() {
    try {
      const res = await fetch('/api/test-generate')
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-8">
      <h1 className="text-3xl font-bold mb-2">Feature #153 Test</h1>
      <p className="text-[#a1a1aa] mb-8">
        Plan generation creates BullMQ job
      </p>

      <div className="space-y-6">
        {/* Test Button */}
        <div>
          <button
            onClick={testGeneratePlan}
            disabled={loading}
            className="px-6 py-3 bg-[#f97316] text-[#0a0a0a] font-bold rounded-lg hover:bg-[#ea580c] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Testing...' : 'Test generatePlan'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className={`p-6 rounded-lg border ${
            result.success
              ? 'bg-[#1a1a1a] border-[#22c55e]'
              : 'bg-[#1a1a1a] border-[#ef4444]'
          }`}>
            <h2 className="text-xl font-bold mb-4">
              {result.success ? '✅ Test Passed' : '❌ Test Failed'}
            </h2>

            {result.error && (
              <p className="text-[#ef4444] mb-4">Error: {result.error}</p>
            )}

            {result.verification && (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span>Job ID returned:</span>
                  <span className={result.verification.jobIdReturned ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {result.verification.jobIdReturned ? '✓ YES' : '✗ NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Job ID:</span>
                  <span className="text-[#f97316]">{result.jobId}</span>
                </div>
                <div className="flex justify-between">
                  <span>DB record created:</span>
                  <span className={result.verification.dbRecordCreated ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {result.verification.dbRecordCreated ? '✓ YES' : '✗ NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>DB status is &apos;pending&apos;:</span>
                  <span className={result.verification.dbStatus === 'pending' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {result.verification.dbStatus === 'pending' ? '✓ YES' : '✗ NO'} ({result.verification.dbStatus})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>BullMQ job enqueued:</span>
                  <span className={result.verification.bullmqEnqueued ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {result.verification.bullmqEnqueued ? '✓ YES' : '✗ NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Response time:</span>
                  <span className={result.verification.fastResponse ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
                    {result.verification.responseTimeMs}ms {result.verification.fastResponse ? '(fast ✓)' : '(slow ⚠)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job List */}
        <div>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a1a1aa] rounded-lg hover:border-[#f97316] transition-colors mb-4"
          >
            Fetch Existing Jobs
          </button>

          {jobs.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <h3 className="font-bold mb-3">Recent Jobs ({jobs.length})</h3>
              <div className="space-y-2 font-mono text-xs">
                {jobs.map((job) => (
                  <div key={job.id} className="flex gap-4 text-[#a1a1aa]">
                    <span className="text-[#f97316]">{job.id.slice(0, 8)}...</span>
                    <span className={
                      job.status === 'pending' ? 'text-[#f59e0b]' :
                      job.status === 'completed' ? 'text-[#22c55e]' :
                      job.status === 'failed' ? 'text-[#ef4444]' : ''
                    }>{job.status}</span>
                    <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
