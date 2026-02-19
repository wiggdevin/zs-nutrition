// Temporary diagnostic endpoint — returns raw Oura API responses
// DELETE THIS FILE after debugging

import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

const OURA_API_BASE = 'https://api.ouraring.com/v2';

export async function GET() {
  try {
    let dbUserId: string;
    try {
      ({ dbUserId } = await requireActiveUser());
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await prisma.fitnessConnection.findFirst({
      where: { userId: dbUserId, platform: 'oura', isActive: true },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Oura connection found' }, { status: 404 });
    }

    const accessToken = decrypt(connection.accessToken);

    // Use a 14-day range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 14);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const params = `start_date=${startStr}&end_date=${endStr}`;

    const endpoints = [
      'daily_activity',
      'daily_sleep',
      'sleep',
      'daily_readiness',
      'heartrate',
      'workout',
    ];

    const results: Record<string, any> = {
      dateRange: `${startStr} to ${endStr}`,
      connectionId: connection.id,
      lastSyncAt: connection.lastSyncAt,
    };

    for (const ep of endpoints) {
      try {
        const url = `${OURA_API_BASE}/usercollection/${ep}?${params}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          results[ep] = { status: resp.status, error: errText };
        } else {
          const data = await resp.json();
          results[ep] = {
            status: 200,
            count: data.data?.length ?? 'no data array',
            next_token: data.next_token,
            sample: data.data?.slice(0, 2), // first 2 records only
          };
        }
      } catch (err) {
        results[ep] = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
