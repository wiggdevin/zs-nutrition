import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const input = searchParams.get('input')

  return NextResponse.json({
    rawInput: input,
    parsed: input ? JSON.parse(input) : null,
    searchParams: Object.fromEntries(searchParams),
  })
}
