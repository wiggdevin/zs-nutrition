import { NextRequest, NextResponse } from 'next/server'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'
import { logger } from '@/lib/safe-logger'

// Singleton FatSecret adapter instance
let fatSecretAdapter: FatSecretAdapter | null = null

function getFatSecretAdapter(): FatSecretAdapter {
  if (!fatSecretAdapter) {
    fatSecretAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )
  }
  return fatSecretAdapter
}

/**
 * GET /api/food-search/details?id=local-1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const foodId = searchParams.get('id')

    if (!foodId) {
      return NextResponse.json({ error: 'Food ID required' }, { status: 400 })
    }

    const fatSecret = getFatSecretAdapter()
    const food = await fatSecret.getFood(foodId)
    return NextResponse.json({ food })
  } catch (error) {
    logger.error('Food details error:', error)
    return NextResponse.json({ error: 'Food not found' }, { status: 404 })
  }
}
