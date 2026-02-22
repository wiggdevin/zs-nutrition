import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { isDevMode } from '@/lib/dev-mode';

const isProduction = process.env.NODE_ENV === 'production';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');

  // Allow requests with no origin (same-origin navigations, server-to-server calls)
  if (!origin) return true;

  const host = request.headers.get('host');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
    if (appUrl && originHost === new URL(appUrl).host) return true;
  } catch {
    return false;
  }

  return false;
}

function csrfCheck(request: NextRequest): NextResponse | null {
  const { method } = request;
  const { pathname } = request.nextUrl;

  if (!STATE_CHANGING_METHODS.has(method)) return null;

  if (!validateOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden', message: 'Invalid origin' }, { status: 403 });
  }

  // For API routes, require a custom header that HTML forms cannot set
  if (pathname.startsWith('/api/')) {
    const contentType = request.headers.get('content-type') || '';
    const trpcSource = request.headers.get('x-trpc-source');
    if (!trpcSource && !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Missing required header' },
        { status: 403 }
      );
    }
  }

  return null;
}

/**
 * Public routes that do not require authentication.
 * - Landing page
 * - Sign-in / sign-up (including sub-routes like /sign-in/factor-one)
 * - Webhook endpoints (Clerk, Stripe, etc.)
 * - Static assets handled by Next.js (_next)
 */
const productionPublicPaths = [
  '/',
  '/sign-in/*',
  '/sign-up/*',
  '/api/webhooks/*',
  '/api/food-search',
  '/api/health',
  '/api/plan/complete',
  '/api/plan/intake',
  '/api/plan/progress',
  '/api/cron/*',
  '/robots.txt',
  '/sitemap.xml',
];

const devOnlyPublicPaths = [
  // API: dev, test, debug, seed routes (prefix-matched via startsWith)
  '/api/dev-*',
  '/api/test-*',
  '/api/debug-*',
  '/api/seed-*',
  '/api/trpc/test.*',
  // Page: test, dev routes
  '/test-*',
  '/test',
  '/dev-*',
];

const publicPaths = isProduction
  ? productionPublicPaths
  : [...productionPublicPaths, ...devOnlyPublicPaths];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return publicPaths.some((p) => {
    if (p === '/') return false;
    if (p.endsWith('/*')) {
      // Slash-based wildcard: /api/webhooks/* matches /api/webhooks and /api/webhooks/clerk
      const prefix = p.slice(0, -2);
      return pathname === prefix || pathname.startsWith(prefix + '/');
    }
    if (p.endsWith('*')) {
      // Pure prefix wildcard: /api/dev-* matches /api/dev-auth, /api/dev-auth/signin, etc.
      const prefix = p.slice(0, -1);
      return pathname.startsWith(prefix);
    }
    return pathname === p;
  });
}

const productionPublicRoutes = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/food-search(.*)',
  '/api/health',
  '/api/plan/complete',
  '/api/plan/intake',
  '/api/plan/progress',
  '/api/cron(.*)',
  '/robots.txt',
  '/sitemap.xml',
];

const devOnlyPublicRoutes = [
  // API: dev, test, debug, seed routes (Clerk route matcher patterns)
  '/api/dev-(.*)',
  '/api/test-(.*)',
  '/api/debug-(.*)',
  '/api/seed-(.*)',
  '/api/trpc/test\\.(.*)',
  // Page: test, dev routes
  '/test-(.*)',
  '/test',
  '/dev-(.*)',
];

const isPublicRoute = createRouteMatcher(
  isProduction ? productionPublicRoutes : [...productionPublicRoutes, ...devOnlyPublicRoutes]
);

/**
 * Clerk middleware that protects all non-public routes.
 * Public routes pass through; everything else requires authentication.
 */
const protectedMiddleware = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // Construct absolute URL for redirect (required by Next.js 15 middleware)
    const signInUrl = new URL('/sign-in', request.url);
    await auth.protect({
      // Redirect unauthenticated users to sign-in
      unauthenticatedUrl: signInUrl.toString(),
    });
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
  const devUserId = request.cookies.get('dev-user-id')?.value;

  if (!devUserId) {
    // API/tRPC routes → return 401 JSON
    if (pathname.startsWith('/api') || pathname.startsWith('/trpc')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to access this resource.' },
        { status: 401 }
      );
    }

    // Page routes → redirect to sign-in
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', pathname);
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

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Defense in depth: block dev/test/debug/seed API routes in production
  // (supplements route-level checks that already return 404)
  if (isProduction) {
    const { pathname } = request.nextUrl;
    if (
      pathname.startsWith('/api/dev-') ||
      pathname.startsWith('/api/test-') ||
      pathname.startsWith('/api/debug-') ||
      pathname.startsWith('/api/seed-') ||
      pathname.startsWith('/test-') ||
      pathname.startsWith('/dev-test') ||
      pathname.startsWith('/dev-')
    ) {
      return new Response('Not Found', { status: 404 });
    }
  }

  const csrfResponse = csrfCheck(request);
  if (csrfResponse) return csrfResponse;

  return handler(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
