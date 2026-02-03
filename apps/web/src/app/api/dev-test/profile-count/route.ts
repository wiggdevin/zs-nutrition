import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';

// Dev-only: count all profiles for the current user (to detect duplicates)
export async function GET() {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      profiles: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    userId: user.id,
    totalProfiles: user.profiles.length,
    activeProfiles: user.profiles.filter((p: any) => p.isActive).length,
    profiles: user.profiles.map((p: any) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      createdAt: p.createdAt,
    })),
  });
}
