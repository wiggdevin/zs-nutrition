import { NextResponse } from 'next/server';

/**
 * Dev-only endpoint for testing toast notifications.
 * GET → returns a page that triggers success and error toasts
 * POST → always returns a 500 error for testing error handling
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  return NextResponse.json(
    { error: 'Simulated server error for toast testing' },
    { status: 500 }
  );
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  return NextResponse.json({ ok: true, message: 'Toast test endpoint is available' });
}
