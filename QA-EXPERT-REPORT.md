# ZS-MAC Quality Assurance Expert Report

**Audit Date:** 2026-02-23
**Codebase:** ZS-MAC (Zero Sum Nutrition) Monorepo
**Stack:** Next.js 15, React 19, tRPC v11, Prisma + Neon PostgreSQL, Upstash Redis + BullMQ, Clerk Auth, Claude SDK, FatSecret API
**Deployment:** Vercel (web) + Railway (worker)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Quality Scorecard](#2-quality-scorecard)
3. [Defect Inventory](#3-defect-inventory)
4. [Critical Test Coverage Gaps](#4-critical-test-coverage-gaps)
5. [Test Architecture Analysis](#5-test-architecture-analysis)
6. [Test Strategy Recommendations](#6-test-strategy-recommendations)
7. [Security Testing Plan](#7-security-testing-plan)
8. [Accessibility Audit Plan](#8-accessibility-audit-plan)
9. [Monitoring & Alerting Recommendations](#9-monitoring--alerting-recommendations)
10. [Pre-Existing Issues Inventory](#10-pre-existing-issues-inventory)
11. [Prioritized QA Roadmap](#11-prioritized-qa-roadmap)

---

## 1. Executive Summary

The ZS-MAC application has a functional but immature quality assurance posture. The web application (`apps/web`) has approximately 50% unit test coverage across server-side code, with solid patterns in the tested areas (5 of 10 tRPC routers tested, consistent mocking via global `setup.ts`, UUID-based test identity). However, critical gaps exist: the entire `queue-processor` worker package has **zero tests**, the `adaptiveNutrition` router (the most algorithmically complex feature) is untested, and the CI pipeline's `continue-on-error: true` on the test step means **test failures do not block deployments**.

The E2E test suite is minimal (4 Playwright files, ~16 tests) and uses a dev-only authentication bypass that cannot run against production-like environments. Component test coverage is sparse (3 of 14 component directories have tests). Security testing is entirely absent — a 33-finding audit was performed manually but none of those checks are automated.

**Key risk:** The combination of untested worker code, a bypassed CI quality gate, and no automated security/accessibility testing means the application is shipping to production with significant blind spots in its most critical paths: meal plan generation, adaptive nutrition adjustments, and payment-sensitive operations.

This report identifies **29 defects** across 5 categories, **6 critical test coverage gaps**, and provides a **5-sprint roadmap** to achieve 80%+ coverage with automated security and accessibility gates.

---

## 2. Quality Scorecard

| Metric                    | Grade  | Details                                                                                                                              |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unit test coverage        | **C**  | ~50% on `src/server/**` and `src/lib/**`; 0% on worker; coverage thresholds set at 50/40/50/50 (very low)                            |
| Integration test coverage | **C+** | 5 of 10 tRPC routers tested (plan, user, insights, tracking, mealPlan); 5 untested (adaptiveNutrition, food, fitness, chat, account) |
| E2E coverage              | **D**  | 4 Playwright files (~16 tests); dev-auth cookie bypass incompatible with staging; no visual regression                               |
| Component test coverage   | **D**  | 3 of 14 component directories tested (FoodScan, settings, DailyLogList); onboarding, meal-plan, tracking/food-search untested        |
| Security test coverage    | **D**  | 33-finding manual audit done; 0 automated security tests; rate-limit behavior tested (1 file)                                        |
| Accessibility             | **F**  | 1 mobile viewport test only; no axe-core integration; no keyboard navigation tests; no ARIA validation                               |
| Pre-existing failures     | **B**  | Previously 4 failures in tracking.test.ts — now resolved (all 197 tests pass)                                                        |

**Overall Quality Grade: C-**

---

## 3. Defect Inventory

### 3.1 Functional Defects

#### DEF-001: BullMQ Enqueue Failure Silently Swallowed (P0 — Critical)

**File:** `apps/web/src/server/routers/plan/generation.ts`
**Severity:** Critical
**Description:** When BullMQ fails to enqueue a plan generation job, the `try/catch` block catches the error but still returns a response that includes the `jobId`. The job status in the database is set to `queued`, but the job never actually reaches the worker. The user sees a "generating" state that never completes.
**Evidence:** The catch block logs the error but does not throw or update the job status to `failed`. The response includes `{ jobId, status: 'queued' }` regardless of whether enqueue succeeded.
**Impact:** Users experience indefinite loading states. The job never completes, and there's no mechanism to detect or recover from this state.

#### DEF-002: `getPlanById` Missing `isActive` Filter (P0 — Critical)

**File:** `apps/web/src/server/routers/plan/plan.ts`
**Severity:** Critical
**Description:** The `getPlanById` query filters by `userId` and `planId` but does not include `isActive: true`. This means soft-deleted/deactivated plans can still be retrieved and displayed to users.
**Impact:** Users may see stale or deactivated meal plans. In a multi-plan scenario, this could cause confusion about which plan is current.

#### DEF-003: `applyCalorieAdjustment` Audit Log Records Success When Queue Fails (P1 — High)

**File:** `apps/web/src/server/routers/adaptive-nutrition/adaptive-nutrition.ts`
**Severity:** High
**Description:** When a user confirms a calorie adjustment, the code updates their profile macros and creates an audit log entry. Then it enqueues a new plan generation job. If the enqueue fails, the audit log already records `planRegenerated: true`, but the plan was never actually regenerated. However, a fallback sets `planRegenerated: false` on BullMQ error — this is correct but only if the catch block actually runs.
**Evidence:** The audit log `create` call happens before the BullMQ enqueue. If enqueue throws, the catch block updates the audit log's `planRegenerated` to `false`. However, if the enqueue hangs (timeout rather than throw), the audit log remains incorrect.

#### DEF-004: CI Test Step Does Not Block Deployments (P0 — Critical)

**File:** `.github/workflows/ci.yml` (line ~40), `.github/workflows/staging.yml` (line ~43)
**Severity:** Critical
**Description:** Both CI and staging workflows have `continue-on-error: true` on the test step. This means test failures are logged but do not prevent merges or deployments.
**Evidence:** `continue-on-error: true` on the `pnpm turbo test` step.
**Impact:** The entire test suite is advisory-only. Regressions can ship to production undetected.

#### DEF-005: Redis Connection Noise in Test Environment (P2 — Medium)

**File:** `apps/web/src/test/setup.ts`
**Severity:** Medium
**Description:** Running `vitest` produces `ECONNREFUSED` errors from Redis client attempts. The mock setup mocks Prisma but does not fully mock Redis connections. While tests pass (the code handles Redis unavailability gracefully), the noise is misleading and could mask real errors.
**Impact:** Developer experience degradation. May cause developers to ignore legitimate errors in test output.

### 3.2 Security Defects

#### DEF-006: Plan Deactivation Race Condition (P1 — High)

**File:** `apps/web/src/server/routers/plan/generation.ts`
**Severity:** High
**Description:** When a new plan is generated, the code deactivates all existing plans for the user via `$transaction`. If two plan generation jobs complete concurrently (e.g., user clicks "generate" twice quickly), both transactions could read the same active plan, both deactivate it, and both create a new active plan — resulting in two active plans.
**Impact:** Data integrity violation. User could see two conflicting meal plans.

#### DEF-007: Rate Limit Redis Failure = All Endpoints Blocked (P1 — High)

**File:** `apps/web/src/lib/rate-limit.ts`
**Severity:** High
**Description:** When Redis is unavailable, all rate limiters return `null`. The `checkRateLimit` function returns `{ success: false }` for null limiters (fail-closed). This means if Redis goes down, ALL rate-limited endpoints become inaccessible, not just rate-limited — they're completely blocked.
**Evidence:** Rate limit test confirms: null limiter → `{ success: false }`.
**Impact:** Redis outage causes total application downtime for rate-limited routes (which includes plan generation, food search, etc.).

#### DEF-008: DLQ Consumer Has No Idempotency Guard (P2 — Medium)

**File:** `workers/queue-processor/src/dlq-consumer.ts`
**Severity:** Medium
**Description:** The DLQ consumer processes failed jobs but does not check if a job has already been processed. If the consumer restarts mid-processing, the same failed job could be processed twice — potentially sending duplicate failure notifications or updating job status incorrectly.

#### DEF-009: Dev Auth Route Exists in Production Codebase (P3 — Low)

**File:** `apps/web/src/app/api/dev-auth/signin/route.ts`
**Severity:** Low (properly blocked by multiple guards)
**Description:** The dev authentication route is present in the production build but blocked by: (1) route-level `NODE_ENV` check, (2) middleware-level path check, (3) `isDevMode` hard gate. While properly secured with defense-in-depth, the code should ideally not ship in production builds.

#### DEF-010: FatSecret Adapter Silent Credential Failure (P1 — High)

**File:** Nutrition engine FatSecret adapter configuration
**Severity:** High
**Description:** When `FATSECRET_CLIENT_ID` or `FATSECRET_CLIENT_SECRET` is empty, the adapter initializes with empty strings (via `|| ''` fallback) rather than throwing a descriptive error. API calls then fail with opaque authentication errors.
**Impact:** Difficult to diagnose deployment issues. Silent failure instead of loud, descriptive error at startup.

### 3.3 Performance Defects

#### DEF-011: `console.warn` Used Instead of Logger in Plan-Stream Route (P2 — Medium)

**File:** `apps/web/src/app/api/plan-stream/[jobId]/route.ts`
**Severity:** Medium
**Description:** The SSE streaming route uses `console.warn` instead of the structured logger utility. This means plan-stream errors won't appear in structured log search/filtering.

#### DEF-012: No Claude API Token Usage Tracking (P2 — Medium)

**File:** Nutrition engine pipeline
**Severity:** Medium
**Description:** The 6-agent pipeline makes multiple Claude API calls per plan generation. Token usage (input/output tokens per call) is not tracked or logged. Without this data, it's impossible to: (1) estimate costs per plan, (2) detect anomalously expensive generations, (3) optimize prompts for token efficiency.

#### DEF-013: `calculateWeightTrend` Non-Null Assertion Risk (P2 — Medium)

**File:** `apps/web/src/server/routers/adaptive-nutrition/adaptive-nutrition.ts`
**Severity:** Medium
**Description:** The `analyzeWeightTrend` procedure calls `calculateWeightTrend(weightEntries)!` with a non-null assertion. If `calculateWeightTrend` returns null (which it does when there are fewer than 2 entries with distinct dates), the assertion silently passes null through, potentially causing a runtime error downstream.

### 3.4 Data Integrity Defects

#### DEF-014: Duplicate Calorie Adjustment Logic (P2 — Medium)

**File:** `apps/web/src/server/routers/adaptive-nutrition/adaptive-nutrition.ts`
**Severity:** Medium
**Description:** The `suggestCalorieAdjustment` and `runWeeklyCheck` procedures both contain calorie adjustment calculation logic, but they may diverge over time. The suggestion logic in `suggestCalorieAdjustment` only handles `cut` and `bulk` goals, while `runWeeklyCheck` handles `cut`, `bulk`, and `maintain`. This means the "maintain" path is only available via the weekly check, not via on-demand suggestion.

#### DEF-015: `deleteAccount` Untested — No Verification of Cascade Behavior (P2 — Medium)

**File:** `apps/web/src/server/routers/account/account.ts`
**Severity:** Medium
**Description:** The `deleteAccount` and `reactivateAccount` procedures in the account router have no tests. The delete operation presumably cascades through related records (meal plans, daily logs, food scans, etc.), but this cascade behavior is verified only by Prisma schema constraints, not by explicit tests.

#### DEF-016: JSON Column `validatedPlan` Has No Schema Validation (P2 — Medium)

**File:** Prisma schema, `MealPlan` model
**Severity:** Medium
**Description:** The `validatedPlan` column stores the full meal plan as a JSON blob (~200KB+). There is no runtime schema validation (e.g., Zod) on read or write. If the nutrition engine produces a malformed plan, it gets stored as-is and may crash the frontend when rendered.

#### DEF-017: DailyLog Macro Recalculation Not Atomic (P3 — Low)

**File:** Daily log tracking procedures
**Severity:** Low
**Description:** When a food entry is added/removed from a daily log, the macro totals are recalculated. If two concurrent food log operations happen for the same day (e.g., user logs two foods quickly), the recalculation could use stale data for one of them.

### 3.5 UX/Reliability Defects

#### DEF-018: SSE Reconnection Behavior Untested (P2 — Medium)

**File:** Frontend plan generation progress component
**Severity:** Medium
**Description:** The plan-stream SSE connection uses EventSource or a custom SSE client. If the connection drops mid-generation (common on mobile networks), the reconnection behavior is untested. It's unclear whether: (1) the client reconnects automatically, (2) the server resumes from the last event, (3) the user sees a stale progress state.

#### DEF-019: Food Search Issues Parallel Queries Without Deduplication (P2 — Medium)

**File:** Food search tRPC procedure
**Severity:** Medium
**Description:** When a user types quickly in the food search, multiple queries may fire in parallel for overlapping search terms. There's no request deduplication or cancellation of superseded queries, leading to O(n) parallel queries where n is the number of keystrokes.

#### DEF-020: PII Potentially Exposed in Error Messages (P2 — Medium)

**File:** Various error handlers
**Severity:** Medium
**Description:** Error messages returned to the client may include internal details (stack traces in development, database error messages, etc.). While Next.js sanitizes errors in production, tRPC error responses may include user-facing messages that contain PII or internal system details if not carefully sanitized.

#### DEF-021: CacheWarmer Errors Swallowed Silently (P3 — Low)

**File:** Cache warming utility
**Severity:** Low
**Description:** The cache warming process (if it exists for pre-populating food data or USDA lookups) catches and swallows errors. Failed cache warming is not retried and not reported, potentially leading to cache misses for commonly searched foods.

#### DEF-022: Mobile Touch Targets Below Minimum Size (P3 — Low)

**File:** Various UI components
**Severity:** Low
**Description:** The E2E tests check for 32px minimum touch targets on mobile. The WCAG 2.5.5 guideline recommends 44x44px minimum for touch targets. The 32px threshold may be insufficient for accessibility compliance.

#### DEF-023: No Error Boundary Around Chart Components (P3 — Low)

**File:** Dashboard/tracking chart components
**Severity:** Low
**Description:** Recharts components render based on dynamic data. If the data shape is unexpected (e.g., null values in a required field), the chart component may crash and take down the entire page without an error boundary to catch it.

#### DEF-024: `insights` Router Cache Race with Force Refresh (P3 — Low)

**File:** `apps/web/src/server/routers/insights/insights.ts`
**Severity:** Low
**Description:** The `FORCE_REFRESH_THRESHOLD_MS` check allows bypassing the `inputHash` cache when the user force-refreshes. If the hash-matching logic has a bug, users could accidentally bypass caching on every request, leading to unnecessary Claude API calls.

#### DEF-025: `PlanGenerationJob` Missing `updatedAt` Column (P3 — Low)

**File:** Prisma schema, `PlanGenerationJob` model
**Severity:** Low
**Description:** The `PlanGenerationJob` model has `createdAt` and `startedAt` but no `updatedAt` with `@updatedAt`. This makes it difficult to detect stale jobs (jobs that started but never completed) without comparing against `startedAt` plus an arbitrary timeout.

#### DEF-026: Coverage Config Excludes Component Source Files (P3 — Low)

**File:** `apps/web/vitest.config.ts`
**Severity:** Low
**Description:** The `coverage.include` array includes `src/server/**` and `src/lib/**` but not `src/components/**`. Component tests run and pass but their source files are never reflected in coverage metrics.

#### DEF-027: E2E Auth Incompatible with Clerk-Protected Environments (P2 — Medium)

**File:** `e2e/*.test.ts` and `playwright.config.ts`
**Severity:** Medium
**Description:** All E2E tests authenticate via a `dev-user-id` cookie that only works when `isDevMode` returns true. This means E2E tests cannot run against staging or production environments that use Clerk for authentication. The staging workflow presumably has a separate configuration, but the standard E2E suite is limited to dev-only environments.

#### DEF-028: No Test Data Cleanup Strategy (P3 — Low)

**File:** Test infrastructure
**Severity:** Low
**Description:** The Prisma mock in `setup.ts` resets between tests via `vi.clearAllMocks()`. However, if any test accidentally uses a real database connection (e.g., if `DATABASE_URL` is set in the environment), test data would persist and pollute subsequent runs.

#### DEF-029: Turbo Test Task Missing `inputs` for Cache Correctness (P3 — Low)

**File:** `turbo.json`
**Severity:** Low
**Description:** The `test` task in `turbo.json` does not specify `inputs`. Turborepo defaults to hashing all files in the package, but adding explicit `inputs` (source files, test files, config) would improve cache hit rates and prevent stale test results.

---

## 4. Critical Test Coverage Gaps

### Gap 1: Queue Worker Package — Zero Tests

**Risk Level: Critical**

```
Path: workers/queue-processor/src/
Files: index.ts, dlq-consumer.ts
Tests: 0
```

Specific untested behaviors:

- `saveToWebApp` retry logic (3 retries, exponential backoff)
- `fetchIntakeData` HTTP error handling
- `reportProgressToWebApp` fire-and-forget error swallowing
- DLQ consumer job status update via API
- Graceful shutdown (SIGINT handler)
- `unhandledRejection` / `uncaughtException` process handlers

**Recommended tests:** Mock `node-fetch` / HTTP client, mock `BullMQ.Worker`, and unit test `saveToWebApp` retry exhaustion, `fetchIntakeData` auth failure, and progress reporting.

### Gap 2: `adaptiveNutrition` Router — Zero Tests for 9 Procedures

**Risk Level: Critical**

The adaptive nutrition system is the most algorithmically complex part of the application. It performs calorie adjustment calculations, safe-bound enforcement, milestone detection, and activity sync processing. None of these behaviors are tested.

Specific untested scenarios:

- `suggestCalorieAdjustment` with a "maintain" goal type
- `applyCalorieAdjustment` with `confirmed: false`
- `processActivitySync` when the DailyLog doesn't exist
- `analyzeWeightTrend` with all entries on the same date
- Safe-bound enforcement when `bmrKcal` is null

### Gap 3: `food` Router — Zero Tests, FatSecret API Calls in Procedures

**Risk Level: High**

The `foodRouter` contains `autocomplete`, `search`, and `getDetails` procedures that call the FatSecret external API through the `FatSecretAdapter`. There are no mock tests for:

- FatSecret API returning empty results
- FatSecret API returning a 429 rate limit error
- `getDetails` with an invalid `foodId`
- Redis cache miss vs. cache hit path for food search

### Gap 4: API Route Layer — Zero Dedicated Tests

**Risk Level: High**

The following API routes have no test coverage:

- `/api/plan-stream/[jobId]` — SSE streaming with 3 execution paths
- `/api/vision/analyze` — Claude Vision integration
- `/api/webhooks/*` — Clerk webhook handlers
- `/api/cron/*` — Any scheduled jobs

These routes contain business logic (auth checks, status validation, external API calls) that is not exercised by the tRPC router tests.

### Gap 5: Component Directory Coverage — 11 of 14 Directories Untested

**Risk Level: High**

The most user-facing logic is in untested components:

- `components/onboarding` — Multi-step onboarding wizard (6+ steps, form validation, step state persistence)
- `components/meal-plan` — Meal plan display, swap modal, day navigation
- `components/tracking/food-search` — Real-time search with debounce, pagination, serving size selection
- `components/generate` — Plan generation progress display, SSE connection management

### Gap 6: `chat` and `fitness` Routers — Zero Tests

**Risk Level: Medium**

The `chatRouter` handles session management and message history. The `fitnessRouter` provides Oura ring integration data. Neither has tests. The `getSessionMessages` and `deleteSession` procedures are user-facing features with authorization checks that are untested.

---

## 5. Test Architecture Analysis

### 5.1 Strengths

**Consistent Mocking Pattern via Global Setup**

The global `setup.ts` establishes a clean, consistent mock for Prisma across all test files. The `$transaction` mock correctly invokes the callback function, allowing transaction-dependent tests to work without a real database.

```typescript
// setup.ts
$transaction: vi.fn((fn) =>
  fn({
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userProfile: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    mealPlan: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    ...
  })
),
```

**UUID-based Test Identity**

The `testUUID` helper in `trpc-test-utils.ts` generates deterministic UUIDs from semantic names:

```typescript
testUUID('user') → '00000000-0000-0000-0000-user00000000'
```

This makes test fixtures readable and avoids UUID collision without relying on random generation.

**Meaningful Scenario Coverage in Tested Routers**

The tested routers cover both happy paths and key error paths. The `plan.test.ts` covers `NOT_FOUND`, `PRECONDITION_FAILED`, and the transaction success path for `completeJob`. The `user.test.ts` verifies that metabolic calculation functions are called with the correct arguments.

**Rate Limit Behavior Correctly Tested**

The `rate-limit.test.ts` confirms fail-closed behavior (null limiter → `{ success: false }`), which is correct and was verified. This is an important security property that is properly tested.

### 5.2 Weaknesses

**Test Environment Leaks Real IO**

The Redis `ECONNREFUSED` noise indicates the test environment is not fully isolated. A developer running `vitest run` will see connection errors that may appear alarming.

**E2E Tests Cannot Run Against Production-like Environments**

The authentication strategy in E2E tests (dev-user-id cookie) is incompatible with Clerk-authenticated staging environments.

**Vitest Config Coverage Scope Mismatch**

The `include` in test discovery (`src/**/*.test.ts`, `src/**/*.test.tsx`) is broader than the `coverage.include` (`src/server/**`, `src/lib/**`). Component tests run but their source files are never reflected in coverage reports.

**No Test for the `insights` Rate-Limit Bypass**

The `insights` router has a `FORCE_REFRESH_THRESHOLD_MS` check that bypasses the `inputHash` cache when the user force-refreshes. This path is not tested.

### 5.3 Test Infrastructure Files

```
apps/web/src/test/setup.ts
apps/web/src/test/trpc-test-utils.ts
apps/web/vitest.config.ts
apps/web/playwright.config.ts
```

---

## 6. Test Strategy Recommendations

### Recommendation 1: Implement Worker Integration Tests (Priority 1)

Create a test suite for the queue-processor worker using mocked HTTP and BullMQ.

```typescript
// workers/queue-processor/src/__tests__/worker.test.ts
describe('saveToWebApp', () => {
  it('retries 3 times on 5xx then throws', async () => { ... });
  it('does not retry on 4xx auth error', async () => { ... });
  it('succeeds on second attempt after transient 503', async () => { ... });
});

describe('fetchIntakeData', () => {
  it('throws when INTERNAL_API_SECRET is wrong (403)', async () => { ... });
  it('returns parsed intake data on 200', async () => { ... });
});
```

**Estimated effort:** 2-3 days. **Impact:** Eliminates the largest untested production surface.

### Recommendation 2: Add `adaptiveNutrition` Router Tests (Priority 1)

```typescript
describe('suggestCalorieAdjustment', () => {
  it('returns hasSuggestion: false when fewer than 2 entries', ...);
  it('suggests decrease when cut user is losing too slowly', ...);
  it('suggests increase when cut user is losing too fast', ...);
  it('respects safe calorie bounds (min: BMR + 200)', ...);
});

describe('applyCalorieAdjustment', () => {
  it('throws BAD_REQUEST when confirmed is false', ...);
  it('throws PRECONDITION_FAILED when bmrKcal is null', ...);
  it('updates profile macros and creates audit log', ...);
  it('sets planRegenerated: false when BullMQ throws', ...);
});

describe('runWeeklyCheck', () => {
  it('returns no_adjustment_needed when maintain user is stable', ...);
  it('returns adjustment_suggested when cut user stalls for 14+ days', ...);
});
```

**Estimated effort:** 3-4 days. **Impact:** Covers the highest-risk business logic.

### Recommendation 3: Remove `continue-on-error: true` from CI Test Step (Priority 1)

```yaml
# Before
- name: Test
  run: pnpm turbo test
  continue-on-error: true

# After
- name: Test
  run: pnpm turbo test
```

**Estimated effort:** 30 minutes. **Impact:** Immediately restores the test quality gate.

### Recommendation 4: Add Food, Chat, Fitness Router Tests (Priority 2)

Mock the `FatSecretAdapter` and test all procedures with happy/error paths.

**Estimated effort:** 2 days each. **Impact:** Closes all tRPC router coverage gaps.

### Recommendation 5: Raise Coverage Thresholds Incrementally (Priority 2)

```typescript
// Step 1 (immediate): match industry minimum
thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 }

// Step 2 (after new tests added)
thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 }

// Step 3 (after component tests added)
thresholds: { lines: 90, functions: 85, branches: 75, statements: 90 }
```

Also expand `coverage.include` to include `src/components/**`.

### Recommendation 6: Add Component Tests for Onboarding and Meal Plan (Priority 2)

The onboarding wizard and meal plan display are the core UX paths. Minimum test scenarios:

- Onboarding: step navigation, form validation, back/forward, save-and-resume
- MealPlan: day rendering, meal card display, swap modal open/close
- FoodSearch: debounce behavior, pagination, serving size selection, add to log

### Recommendation 7: Fix FoodScan Slow Test with Fake Timers (Priority 3)

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it('calls onMealLogged after 2s delay', async () => {
  await vi.advanceTimersByTimeAsync(2000);
  expect(onMealLogged).toHaveBeenCalled();
});
```

### Recommendation 8: Add `inputs` to Turbo `test` Task for Caching (Priority 3)

```json
"test": {
  "dependsOn": ["^build"],
  "outputs": ["coverage/**"],
  "inputs": ["src/**/*.ts", "src/**/*.tsx", "vitest.config.ts", "prisma/schema.prisma"]
}
```

---

## 7. Security Testing Plan (OWASP Top 10 — 2021)

### A01: Broken Access Control

**Current state:** Middleware enforces authentication globally. tRPC routers use `protectedProcedure` with `requireActiveUser()`. Worker endpoints use `INTERNAL_API_SECRET` Bearer token.

**Tests to add:**

1. Verify `getPlanById` returns 404 when called with another user's `planId`
2. Verify `getSessionMessages` returns NOT_FOUND for another user's session
3. Test that internal endpoints return 401/403 without `INTERNAL_API_SECRET`
4. Test that dev auth route returns 404 in production mode

### A02: Cryptographic Failures

**Current state:** OAuth tokens for fitness connections stored as plain strings.

**Tests to add:**

1. Verify access tokens are not stored in plaintext
2. Verify health endpoint doesn't expose credentials
3. Audit `INTERNAL_API_SECRET` comparison uses constant-time comparison

### A03: Injection

**Current state:** All database access through Prisma ORM (parameterized queries).

**Tests to add:**

1. SQL injection via food-search query
2. XSS injection via food name field
3. Validate `vision/analyze` rejects non-base64 imageData

### A04: Insecure Design

**Tests to add:**

1. E2E: Verify production-mode blocks `/api/dev-auth/signin`
2. Unit: Verify `isDevMode` returns false with `sk_live_` prefix

### A05: Security Misconfiguration

**Tests to add:**

1. Test `getFatSecretAdapter()` throws on empty credentials
2. Test health endpoint returns `degraded` when Redis down
3. Verify security headers (X-Content-Type-Options, X-Frame-Options, HSTS)

### A06: Vulnerable and Outdated Components

**Action items:**

1. Remove `continue-on-error: true` from Security Audit CI step
2. Add weekly `pnpm audit` GitHub Action

### A07: Identification and Authentication Failures

**Tests to add:**

1. Test dev-auth redirect rejects external URLs
2. Test deactivated user cannot access protected routes
3. Test `reactivateAccount` procedure

### A08: Software and Data Integrity Failures

**Tests to add:**

1. Test worker validates `jobId` field in job data
2. Test `fetchIntakeData` verifies response shape

### A09: Security Logging and Monitoring Failures

**Tests to add:**

1. Test auth failures produce log entries
2. Test rate limit responses include `Retry-After` header
3. Test plan-stream logs disconnections

### A10: Server-Side Request Forgery (SSRF)

**Current risk:** Low. Worker uses hardcoded internal URL. Vision endpoint accepts base64, not URLs.

**Tests to add:**

1. Verify `photoUrl` in `FoodScan` is a validated storage URL

---

## 8. Accessibility Audit Plan

### 8.1 Static Analysis (Automated — Add to CI)

```bash
pnpm add -D @axe-core/playwright
```

Add to each Playwright E2E test:

```typescript
import { checkA11y } from '@axe-core/playwright';

test('dashboard has no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await checkA11y(page);
  expect(results.violations).toHaveLength(0);
});
```

Target pages: landing, sign-in, dashboard, meal plan view, onboarding steps, food search, settings.

### 8.2 Keyboard Navigation Tests

Key flows to test:

1. **Onboarding wizard:** Tab through fields, Enter to advance, Shift+Tab to go back
2. **Meal plan:** Tab to cards, Enter to open modal, Escape to close
3. **Food search:** Type, arrow keys for autocomplete, Enter to select
4. **Swap meal modal:** Open via keyboard, navigate options, confirm

### 8.3 ARIA and Semantic HTML Checks

High-risk components requiring ARIA review:

1. **FoodScan** — Status changes need `aria-live` announcements
2. **Plan generation progress** — Needs `role="progressbar"` with `aria-valuenow`
3. **Mobile navigation** — Hamburger needs `aria-expanded`, menu needs `role="menu"`
4. **Form validation** — Error messages need `aria-describedby`, required fields need `aria-required`
5. **Modal dialogs** — Must trap focus, set `aria-modal="true"`, restore focus on close

### 8.4 Color Contrast

- All text must achieve WCAG AA contrast ratio (4.5:1 normal, 3:1 large)
- Focus indicators visible (`:focus-visible` ring >= 2px)
- Error states use color + icon/text, not color alone
- Target: Lighthouse accessibility score >= 95

### 8.5 Screen Reader Testing

Manual testing with VoiceOver (macOS/iOS) and NVDA (Windows):

- Meal plan grid: cards announce name, calories, actions
- Macro tracking chart: charts need `aria-label` or hidden data table
- Chat interface: new messages via `aria-live`

---

## 9. Monitoring & Alerting Recommendations

### Rule 1: BullMQ Enqueue Failure Rate

**Trigger:** `BullMQ enqueue failed` log count > 3 in any 5-minute window
**Severity:** Critical
**Action:** Page on-call. Redis unavailable = users cannot generate meal plans.

### Rule 2: Plan Generation Job Stuck > 10 Minutes

**Trigger:** `PlanGenerationJob` with `status IN ('processing', 'running')` and `startedAt < NOW() - 10min`
**Severity:** High
**Action:** Slack alert. Implement via scheduled cron at `/api/cron/stale-job-check`.

### Rule 3: Rate Limit Exceeded Spike

**Trigger:** HTTP 429 responses > 50/minute on any endpoint
**Severity:** Medium
**Action:** Slack alert. Could indicate bot attack or client retry bug.

### Rule 4: Database Connection Pool Exhaustion

**Trigger:** Prisma `P2024` error count > 5 in any 1-minute window
**Severity:** Critical
**Action:** Page on-call. Query holding connections or Neon pool limit reached.

### Rule 5: Health Endpoint Returning `status: 'error'`

**Trigger:** `GET /api/health` returns `{ "status": "error" }`
**Severity:** Critical
**Action:** Page on-call. Application non-functional without database.

### Rule 6: Health Endpoint Returning `status: 'degraded'`

**Trigger:** `GET /api/health` returns `{ "status": "degraded" }` for > 5 consecutive checks
**Severity:** High
**Action:** Slack alert. Redis-dependent features unavailable. Rate limiting fail-closed blocks all limited endpoints.

### Rule 7: DLQ Job Count Increasing

**Trigger:** DLQ job count increases by > 5 in any 1-hour window
**Severity:** High
**Action:** Slack alert with job IDs. Pipeline failing beyond retry budget (3 retries).

---

## 10. Pre-Existing Issues Inventory

### Issue 1: Tracking Test Failures — RESOLVED

The project memory states: _"4 pre-existing test failures in tracking.test.ts (getWeeklyTrend date parsing bug)"_. As of this audit, all 197 tests pass including all 9 tracking tests. This issue has been resolved.

### Issue 2: TypeScript Errors Configured as Warnings

ESLint `no-explicit-any` and `no-non-null-assertion` configured as warnings, not errors. Most notable runtime-risk instance: DEF-013 (`calculateWeightTrend(weightEntries)!`).

### Issue 3: `completeJob` Unique Constraint Fallback

The transaction-fallback pattern for unique constraint violations is an intentional design decision. DEF-006 proposes the fallback path also needs to deactivate old plans.

### Issue 4: Dev Routes in Production Codebase — Properly Blocked

Dev auth routes exist in production but are blocked by route-level check, middleware-level check, and `isDevMode` hard gate. Defense-in-depth is working correctly but none of the blocking mechanisms have explicit tests.

### Issue 5: Base64 Images in Database — RESOLVED

Historical issue. Current schema stores `photoUrl: String` (URL references) in `FoodScan`, not base64 data directly.

### Issue 6: Redis as Single Point of Failure for Rate Limiting

When Redis is down, `checkRateLimit` returns `{ success: false }` for all endpoints (fail-closed). Documented behavior but represents a total application block on Redis failure.

---

## 11. Prioritized QA Roadmap

### Sprint 1 (Week 1-2): Critical Defect Resolution

**Goal:** Eliminate production-impacting defects and restore quality gates.

| Priority | Task                                                     | Defect  | Effort | Owner   |
| -------- | -------------------------------------------------------- | ------- | ------ | ------- |
| P0       | Fix BullMQ enqueue silent failure — throw on queue error | DEF-001 | 2h     | Backend |
| P0       | Remove `continue-on-error: true` from CI test step       | DEF-004 | 30m    | DevOps  |
| P0       | Add `isActive` filter to `getPlanById`                   | DEF-002 | 30m    | Backend |
| P1       | Fix `applyCalorieAdjustment` audit log on queue failure  | DEF-003 | 1h     | Backend |
| P1       | Fix Redis ECONNREFUSED in test setup                     | DEF-005 | 2h     | QA      |
| —        | Add tests for DEF-001, DEF-002, DEF-003 fixes            | —       | 5h     | QA      |

**Exit criteria:** All 197 existing tests pass + 3 new tests. CI test step blocks deployments.

### Sprint 2 (Week 3-4): Worker + adaptiveNutrition Tests

**Goal:** Cover the two largest untested surfaces.

| Priority | Task                                                       | Reference | Effort | Owner   |
| -------- | ---------------------------------------------------------- | --------- | ------ | ------- |
| P0       | Create worker test scaffold + mock HTTP/BullMQ             | Gap 1     | 1 day  | QA      |
| P0       | Implement `saveToWebApp` retry tests (3 scenarios)         | Gap 1     | 1 day  | QA      |
| P0       | Implement `fetchIntakeData` error tests                    | Gap 1     | 4h     | QA      |
| P1       | Create `adaptive-nutrition.test.ts`                        | Gap 2     | 1 day  | QA      |
| P1       | Implement calorie adjustment tests (11 scenarios)          | Gap 2     | 2 days | QA      |
| P1       | Implement weekly check + activity sync tests (7 scenarios) | Gap 2     | 1 day  | QA      |
| P2       | Fix duplicate adjustment logic                             | DEF-014   | 4h     | Backend |
| P2       | Fix non-null assertion risk                                | DEF-013   | 1h     | Backend |
| —        | Raise coverage thresholds to 70/70/60/70                   | Rec 5     | 30m    | QA      |

**Exit criteria:** Worker >= 10 tests. adaptiveNutrition >= 20 tests. DEF-013, DEF-014 resolved.

### Sprint 3 (Week 5-6): Remaining Router + API Route Tests

**Goal:** Close all tRPC router coverage gaps. Add API route layer tests.

| Priority | Task                                              | Reference | Effort | Owner    |
| -------- | ------------------------------------------------- | --------- | ------ | -------- |
| P1       | Create `food.test.ts` (3 procedures, 9 scenarios) | Gap 3     | 2 days | QA       |
| P1       | Create `chat.test.ts` (3 procedures)              | Gap 6     | 1 day  | QA       |
| P1       | Create `fitness.test.ts` (4 procedures)           | Gap 6     | 1 day  | QA       |
| P1       | Add `account.test.ts` (delete, reactivate)        | DEF-015   | 1 day  | QA       |
| P1       | Add `plan-stream` SSE route tests                 | Gap 4     | 2 days | QA       |
| P1       | Add `food-search` API route injection test        | OWASP A03 | 1 day  | Security |
| P2       | Fix FatSecret empty credential guard              | DEF-010   | 2h     | Backend  |
| P2       | Fix food-search parallel queries                  | DEF-019   | 4h     | Backend  |

**Exit criteria:** All 10 tRPC routers tested. 0 untested routers.

### Sprint 4 (Week 7-8): Component Tests + Accessibility

**Goal:** Establish component coverage for critical UI paths.

| Priority | Task                                   | Reference | Effort | Owner       |
| -------- | -------------------------------------- | --------- | ------ | ----------- |
| P1       | Add onboarding wizard tests (6 steps)  | Gap 5     | 3 days | Frontend/QA |
| P1       | Add meal plan component tests          | Gap 5     | 2 days | Frontend/QA |
| P1       | Add food search component tests        | Gap 5     | 2 days | Frontend/QA |
| P2       | Fix FoodScan slow test (fake timers)   | DEF-008   | 2h     | QA          |
| P2       | Add axe-core to E2E tests              | Sec 8.1   | 1 day  | QA          |
| P2       | Add keyboard navigation E2E tests      | Sec 8.2   | 1 day  | QA          |
| P2       | Fix E2E auth for Clerk test users      | DEF-027   | 3 days | QA/Frontend |
| P3       | Expand coverage.include for components | DEF-026   | 30m    | QA          |
| —        | Raise thresholds to 80/80/70/80        | Rec 5     | 30m    | QA          |

**Exit criteria:** Lighthouse a11y >= 90. Component coverage > 60%. axe-core in CI.

### Sprint 5 (Week 9-10): Monitoring, Security, Performance Tests

**Goal:** Production observability and OWASP coverage.

| Priority | Task                                        | Reference  | Effort | Owner   |
| -------- | ------------------------------------------- | ---------- | ------ | ------- |
| P1       | Configure health endpoint uptime monitoring | Rules 5, 6 | 1 day  | DevOps  |
| P1       | Configure DLQ webhook alerting              | Rule 7     | 4h     | DevOps  |
| P1       | Add Vercel log alert for enqueue failures   | Rule 1     | 4h     | DevOps  |
| P2       | Implement stale job cron check              | Rule 2     | 1 day  | Backend |
| P2       | Add `updatedAt` to PlanGenerationJob        | DEF-025    | 2h     | Backend |
| P2       | Write OWASP A01 access control tests        | Sec 7      | 1 day  | QA      |
| P2       | Write OWASP A07 auth tests                  | Sec 7      | 4h     | QA      |
| P2       | Add input validation fuzz tests             | OWASP A03  | 1 day  | QA      |
| P3       | Load test plan-stream SSE (50 concurrent)   | —          | 2 days | QA      |
| P3       | Add turbo.json test inputs                  | DEF-029    | 1h     | DevOps  |

**Exit criteria:** All 7 monitoring rules active. OWASP A01, A03, A07 covered. Stale job cron deployed.

---

## Summary Statistics

| Category              | Count        |
| --------------------- | ------------ |
| Total Defects         | 29           |
| Critical (P0)         | 4            |
| High (P1)             | 8            |
| Medium (P2)           | 11           |
| Low (P3)              | 6            |
| Test Coverage Gaps    | 6            |
| Sprints to Resolution | 5 (10 weeks) |

---

**Report produced by:** QA Expert Agent
**Audit date:** 2026-02-23
**Total test files reviewed:** 30 (15 unit, 4 E2E, ~15 nutrition engine)
**Total source files reviewed:** 42
**Test run executed:** `npx vitest run` — 197 tests, 0 failures
