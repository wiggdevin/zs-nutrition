import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const input = searchParams.get('input')

  return NextResponse.json({
    rawInput: input,
    parsed: input ? JSON.parse(input) : null,
    searchParams: Object.fromEntries(searchParams),
  })
}
