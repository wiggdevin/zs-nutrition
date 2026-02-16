# Task 3.6 & 3.7 Implementation Summary

## Overview

Implemented soft deletes for MealPlan model and prepared partial unique index for enforcing one active plan per user.

## Changes Made

### 1. Schema Changes (`apps/web/prisma/schema.prisma`)

- Added `deletedAt DateTime?` field to MealPlan model for soft delete timestamp
- Added comment that status can now be "deleted"
- Added new index `@@index([userId, isActive, deletedAt])` for query optimization

### 2. Query Updates

All MealPlan queries now include `deletedAt: null` to exclude soft-deleted records:

**Files Updated:**

- `apps/web/src/server/routers/plan.ts` - getActivePlan, getPlanById, completeJob
- `apps/web/src/server/routers/meal.ts` - getActivePlan, getTodaysPlanMeals, logMealFromPlan
- `apps/web/src/server/routers/user.ts` - deactivateAccount
- `apps/web/src/lib/save-plan.ts` - savePlanToDatabase transaction
- `apps/web/src/app/api/plan/active/route.ts`
- `apps/web/src/app/api/plan/[id]/route.ts`
- `apps/web/src/app/api/plan/history/route.ts`
- `apps/web/src/app/api/plan/pdf/route.ts`
- `apps/web/src/app/api/plan/verify/route.ts`
- `apps/web/src/app/api/plan/swap/route.ts`
- `apps/web/src/app/api/plan/swap/alternatives/route.ts`
- `apps/web/src/app/api/plan/swap/undo/route.ts`
- `apps/web/src/app/api/dashboard/data/route.ts`
- `apps/web/src/app/api/tracking/log-from-plan/route.ts`

### 3. New Utility Functions (`apps/web/src/lib/plan-utils.ts`)

Created utility functions for plan management:

- `isUniqueConstraintError(error)` - Detects Prisma P2002 unique constraint violations
- `softDeleteMealPlan(prisma, planId, userId)` - Soft deletes a plan
- `activateMealPlanWithConstraintHandling(prisma, planId, userId)` - Activates plan with constraint retry
- `deactivateAllUserPlans(prisma, userId, excludePlanId?)` - Deactivates all user plans

### 4. Constraint Violation Handling

Updated `save-plan.ts` and `plan.ts` router to gracefully handle unique constraint violations:

- Uses transactions for atomic deactivate-then-create operations
- Catches P2002 errors and retries with forced deactivation
- Prevents race conditions from creating multiple active plans

### 5. SQL Migration File (`apps/web/prisma/add-soft-delete-index.sql`)

Created SQL file for the partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_userId_active_unique"
ON "MealPlan" ("userId")
WHERE "isActive" = 1 AND "deletedAt" IS NULL;
```

## Deployment Steps

### Step 1: Apply Schema Changes

```bash
cd apps/web
npx prisma db push
```

Note: The schema has already been applied via `db push` during development.

### Step 2: Generate Prisma Client

```bash
npx prisma generate
```

Note: There's a known issue with `prisma generate` on Node.js 22.x in this environment.
If this fails, try:

- Using Node.js 20.x
- Running in a CI environment (GitHub Actions, etc.)
- The schema is valid and works with `db push`

### Step 3: Apply Partial Unique Index

After the schema is applied, run the SQL file to add the partial unique index:

```bash
npx prisma db execute --file ./prisma/add-soft-delete-index.sql
```

Or manually in SQLite:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_userId_active_unique"
ON "MealPlan" ("userId")
WHERE "isActive" = 1 AND "deletedAt" IS NULL;
```

## Verification Checklist

### Soft Delete Test

1. Query a plan, note its ID
2. Soft delete: `UPDATE MealPlan SET deletedAt = datetime('now'), isActive = 0, status = 'deleted' WHERE id = 'plan-id'`
3. Verify TrackedMeal records still exist for that plan
4. Verify the plan no longer appears in `/api/plan/history`
5. Query with `deletedAt IS NOT NULL` to verify it's recoverable

### Unique Constraint Test

1. Via SQLite console: `sqlite3 prisma/prisma/dev.db`
2. Try: `INSERT INTO MealPlan (id, userId, profileId, isActive, status) VALUES ('test1', 'user1', 'profile1', 1, 'active');`
3. Try: `INSERT INTO MealPlan (id, userId, profileId, isActive, status) VALUES ('test2', 'user1', 'profile1', 1, 'active');`
4. Second insert should fail with UNIQUE constraint error
5. Clean up: `DELETE FROM MealPlan WHERE id IN ('test1', 'test2');`

### Application Behavior Test

1. Generate a new plan for a user
2. Verify old plan is marked as replaced, not deleted
3. Verify new plan is the only active one
4. Check that meal logging still works with the new plan

## Architecture Notes

### Why Soft Deletes?

- Deleting a MealPlan cascades to TrackedMeal, permanently destroying food diary history
- Soft deletes preserve the user's tracking data even when they regenerate plans
- Allows for potential future "restore deleted plan" functionality

### Why Partial Unique Index?

- Defense-in-depth: prevents multiple active plans per user at database level
- The application already deactivates old plans before creating new ones
- The constraint catches edge cases and race conditions
- Partial index only applies when `isActive = true AND deletedAt IS NULL`

### SQLite Considerations

- SQLite supports partial indexes with `WHERE` clause
- The index syntax is PostgreSQL-compatible for future migration
- JSON type is supported in Prisma 6.x with SQLite
