/**
 * Test page for Feature #464: QA score badge styling
 *
 * Displays all three QA status badges (PASS, WARN, FAIL) side by side
 * for visual verification of the color requirements.
 */

'use client'

import { notFound } from 'next/navigation'

export default function TestFeature464Badges() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const badges = [
    {
      status: 'PASS',
      score: 92,
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.1)',
      borderColor: 'rgba(34, 197, 94, 0.3)',
      description: 'Green badge for PASS status',
    },
    {
      status: 'WARN',
      score: 68,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      description: 'Amber badge for WARN status',
    },
    {
      status: 'FAIL',
      score: 35,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      description: 'Red badge for FAIL status',
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature #464: QA Score Badge Styling</h1>
        <p className="text-muted-foreground mb-8">
          Test page to verify that QA score badges display correct colors based on status
        </p>

        <div className="mb-8 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-xl font-bold mb-4">Requirements</h2>
          <ul className="space-y-2 text-sm">
            <li>✅ PASS status shows green (#22c55e)</li>
            <li>✅ WARN status shows amber (#f59e0b)</li>
            <li>✅ FAIL status shows red (#ef4444)</li>
            <li>✅ Score number is displayed</li>
            <li>✅ Tooltip with status and score available (hover over badge)</li>
          </ul>
        </div>

        <h2 className="text-2xl font-bold mb-6">Badge Display Test</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {badges.map((badge) => (
            <div
              key={badge.status}
              className="p-6 rounded-lg border border-border bg-card space-y-4"
            >
              <h3 className="text-lg font-bold">{badge.status} Badge</h3>
              <p className="text-sm text-muted-foreground">{badge.description}</p>

              {/* The actual badge component copied from meal-plan/page.tsx */}
              <div
                className="rounded-lg border px-3 py-2 text-center"
                style={{
                  backgroundColor: badge.bgColor,
                  borderColor: badge.borderColor,
                }}
                title={`QA Status: ${badge.status} (${badge.score}%)`}
                data-testid={`qa-badge-${badge.status.toLowerCase()}`}
              >
                <p className="font-mono text-xs text-muted-foreground">QA Score</p>
                <p
                  className="text-lg font-bold"
                  style={{ color: badge.color }}
                >
                  {badge.score}%
                </p>
              </div>

              <div className="text-xs space-y-1 pt-2 border-t border-border">
                <p><strong>Color:</strong> <span style={{color: badge.color}}>{badge.color}</span></p>
                <p><strong>Background:</strong> {badge.bgColor}</p>
                <p><strong>Border:</strong> {badge.borderColor}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-xl font-bold mb-4">Verification Steps</h2>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            <li>Verify PASS badge is green (#22c55e)</li>
            <li>Verify WARN badge is amber (#f59e0b)</li>
            <li>Verify FAIL badge is red (#ef4444)</li>
            <li>Hover over each badge to verify tooltip shows status and score</li>
            <li>Check that score numbers are displayed (92%, 68%, 35%)</li>
            <li>Navigate to /meal-plan with actual plans to verify in production</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
