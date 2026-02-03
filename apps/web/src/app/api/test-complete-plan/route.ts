import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "completed",
    planId: "test-plan-123",
    message: "Test plan generation completed"
  });
}
