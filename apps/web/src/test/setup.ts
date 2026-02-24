import { vi } from 'vitest';

// Mock Prisma with all necessary methods
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    onboardingState: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    mealPlan: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    planGenerationJob: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    trackedMeal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    dailyLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    weightEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    aiInsight: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    mealSwap: {
      findMany: vi.fn(),
    },
    activitySync: {
      findMany: vi.fn(),
    },
    calorieAdjustment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) =>
      fn({
        user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        userProfile: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        mealPlan: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
        trackedMeal: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
        dailyLog: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      })
    ),
  },
}));

// Mock BullMQ queue to prevent Redis connection attempts
vi.mock('@/lib/queue', () => ({
  planGenerationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id', name: 'generate-plan' }),
  },
  PLAN_GENERATION_QUEUE: 'plan-generation',
}));

// Mock Redis
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
  createNewRedisConnection: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  generalLimiter: null,
  checkRateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock auth utilities
// getAuthenticatedUser returns a user object based on the input Clerk ID
// This allows tests to control the dbUserId by setting the context's userId field
vi.mock('@/lib/auth', () => ({
  getClerkUserId: vi.fn(() => Promise.resolve('test-clerk-user-id')),
  getAuthenticatedUser: vi.fn((clerkId: string) => {
    // Return a user object with id matching the clerkId for testing
    // This allows the enforceAuth middleware to set ctx.dbUserId correctly
    return Promise.resolve({ id: clerkId });
  }),
}));
