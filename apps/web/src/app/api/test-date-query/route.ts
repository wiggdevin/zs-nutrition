import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDay } from '@/lib/date-utils'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { date } = body

    const dateOnly = parseLocalDay(date)

    const meals = await prisma.trackedMeal.findMany({
      where: {
        mealName: { contains: 'Feature 243' },
        loggedDate: dateOnly,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      inputDate: date,
      parsedDate: dateOnly.toISOString(),
      mealCount: meals.length,
      meals: meals.map(m => ({
        name: m.mealName,
        loggedDate: m.loggedDate.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
