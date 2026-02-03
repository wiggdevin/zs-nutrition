import { NextResponse } from 'next/server';

/**
 * Dev-only endpoint for testing toast notifications.
 * GET → returns a page that triggers success and error toasts
 * POST → always returns a 500 error for testing error handling
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Simulated server error for toast testing' },
    { status: 500 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Toast test endpoint is available' });
}
