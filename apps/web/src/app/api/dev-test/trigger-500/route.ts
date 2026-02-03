import { NextResponse } from 'next/server'
import { safeLogError } from '@/lib/safe-logger'

/**
 * DEV-ONLY: Endpoint that deliberately triggers a 500 Internal Server Error.
 * Used for testing that the UI shows friendly error messages and no stack traces.
 */
export async function GET() {
  try {
    // Simulate an unexpected internal error (e.g., database crash)
    throw new Error(
      'SIMULATED_DB_CRASH: connection to database at "postgresql://admin:s3cretP@ss@db.internal:5432/prod" refused — ECONNREFUSED 10.0.0.5:5432'
    )
  } catch (error) {
    safeLogError('[/api/dev-test/trigger-500] Internal server error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
