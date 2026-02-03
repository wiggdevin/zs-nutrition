import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeLogError } from "@/lib/safe-logger";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Delete the dev-user-id cookie by setting it with maxAge=0
    cookieStore.set("dev-user-id", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ success: true, message: "Signed out successfully" });
  } catch (error) {
    safeLogError("Dev auth signout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
