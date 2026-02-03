import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { safeLogError } from "@/lib/safe-logger";

/**
 * Validates that a redirect URL is safe (internal URL only)
 * Prevents open redirect attacks
 */
function isValidRedirectUrl(url: string | null): boolean {
  if (!url) return false;
  // Must start with / and not contain // (to prevent protocol-relative URLs)
  return url.startsWith('/') && !url.startsWith('//');
}

// Dev-only sign-in endpoint that authenticates an existing user
// This simulates what Clerk would do when an existing user signs in
export async function POST(request: NextRequest) {
  // Only allow in dev mode
  const isDevMode =
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === "sk_test_placeholder" ||
    process.env.CLERK_SECRET_KEY === "";

  if (!isDevMode) {
    return NextResponse.json(
      { error: "Dev auth is only available in development mode" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, redirectUrl } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        onboarding: true,
        profiles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email. Please sign up first." },
        { status: 404 }
      );
    }

    // Check if account is deactivated
    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "This account has been deactivated.",
          code: "ACCOUNT_DEACTIVATED",
          message: "Your account has been deactivated and is no longer accessible."
        },
        { status: 403 }
      );
    }

    // Set dev auth cookie
    const cookieStore = await cookies();
    cookieStore.set("dev-user-id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
    });

    // Determine if user has completed onboarding
    const hasCompletedOnboarding = user.onboarding?.completed === true;
    const hasProfile = user.profiles.length > 0;

    // Determine redirect destination:
    // 1. Use the provided redirect_url if it's valid (user was trying to access a protected page)
    // 2. Otherwise, use default behavior based on onboarding status
    let redirectTo: string;
    if (isValidRedirectUrl(redirectUrl)) {
      redirectTo = redirectUrl;
    } else {
      // Returning user with profile → dashboard
      // User without completed onboarding → onboarding
      redirectTo = hasCompletedOnboarding || hasProfile ? "/dashboard" : "/onboarding";
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      redirectTo,
      hasCompletedOnboarding,
      hasProfile,
      message: "Signed in successfully",
    });
  } catch (error: any) {
    safeLogError("Dev auth signin error:", error);
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}
