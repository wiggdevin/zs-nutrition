import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isDevMode =
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY === "sk_test_placeholder" ||
  process.env.CLERK_SECRET_KEY === "";

/**
 * Public routes that do not require authentication.
 * - Landing page
 * - Sign-in / sign-up (including sub-routes like /sign-in/factor-one)
 * - Webhook endpoints (Clerk, Stripe, etc.)
 * - Dev auth endpoints (sign-in/sign-up API in dev mode)
 * - Static assets handled by Next.js (_next)
 */
const publicPaths = [
  "/",
  "/sign-in",
  "/sign-up",
  "/api/webhooks",
  "/api/dev-auth",
  "/api/test-empty-state",
  "/api/dev-test",
  "/test-network-error",
  "/test-500-error",
  "/test-loading-states",
];

function isPublicPath(pathname: string): boolean {
  // Exact match for root
  if (pathname === "/") return true;
  // Prefix match for other public paths
  return publicPaths.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/"))
  );
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/dev-auth(.*)",
  "/api/test-empty-state(.*)",
  "/api/dev-test(.*)",
  "/test-network-error(.*)",
  "/test-500-error(.*)",
  "/test-loading-states(.*)",
]);

/**
 * Clerk middleware that protects all non-public routes.
 * Public routes pass through; everything else requires authentication.
 */
const protectedMiddleware = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

/**
 * Dev-mode middleware: enforces authentication using the dev-user-id cookie.
 * Public routes pass through; protected routes require the cookie.
 * API routes return 401 JSON; page routes redirect to /sign-in.
 */
function devMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for dev auth cookie
  const devUserId = request.cookies.get("dev-user-id")?.value;

  if (!devUserId) {
    // API/tRPC routes → return 401 JSON
    if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access this resource." },
        { status: 401 }
      );
    }

    // Page routes → redirect to sign-in
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

/**
 * Determine which handler to use at module-evaluation time.
 * If CLERK_SECRET_KEY is configured, use the Clerk-protected middleware.
 * Otherwise, use the dev middleware that checks for dev-user-id cookie.
 */
const handler = isDevMode ? devMiddleware : protectedMiddleware;

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  return handler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
