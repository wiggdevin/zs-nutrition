import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json({
    status: "completed",
    planId: "test-plan-123",
    message: "Test plan generation completed"
  });
}
