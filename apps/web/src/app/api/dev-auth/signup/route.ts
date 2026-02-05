import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { logger } from '@/lib/safe-logger';
import { isDevMode } from '@/lib/dev-mode';

// Dev-only sign-up endpoint that creates a user in the database
// This simulates what Clerk would do when a new user signs up
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // Only allow in dev mode
  if (!isDevMode) {
    return NextResponse.json(
      { error: 'Dev auth is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User exists - treat as sign-in
      const cookieStore = await cookies();
      cookieStore.set('dev-user-id', user.id, {
        httpOnly: true,
        secure: (process.env.NODE_ENV as string) === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'lax',
      });

      return NextResponse.json({
        success: true,
        userId: user.id,
        isNewUser: false,
        message: 'User already exists, signed in',
      });
    }

    // Create new user with a dev clerkUserId
    const devClerkUserId = `dev_${uuidv4()}`;
    user = await prisma.user.create({
      data: {
        clerkUserId: devClerkUserId,
        email,
      },
    });

    // Set a dev auth cookie
    const cookieStore = await cookies();
    cookieStore.set('dev-user-id', user.id, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax',
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      isNewUser: true,
      message: 'Account created successfully',
    });
  } catch (error: any) {
    logger.error('Dev auth signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
