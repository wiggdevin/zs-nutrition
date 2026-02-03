import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDay } from '@/lib/date-utils'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const devUserId = cookieStore.get('dev-user-id')?.value

  if (!devUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const dateStr = searchParams.get('date') || undefined

  const dateOnly = dateStr ? parseLocalDay(dateStr) : parseLocalDay(new Date().toISOString().split('T')[0])

  const meals = await prisma.trackedMeal.findMany({
    where: {
      userId: devUserId,
      mealName: { contains: 'Feature 243' },
      loggedDate: dateOnly,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    queryDate: dateStr,
    parsedDate: dateOnly.toISOString(),
    mealCount: meals.length,
    meals: meals.map(m => ({
      name: m.mealName,
      loggedDate: m.loggedDate.toISOString(),
    })),
  })
}
