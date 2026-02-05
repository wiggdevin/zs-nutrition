import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';

// DELETE - Delete onboarding state (for testing)
export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Delete onboarding state if it exists
  const existing = await prisma.onboardingState.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    await prisma.onboardingState.delete({
      where: { id: existing.id },
    });
    return NextResponse.json({ success: true, message: 'OnboardingState deleted' });
  }

  return NextResponse.json({ success: true, message: 'No OnboardingState to delete' });
}
