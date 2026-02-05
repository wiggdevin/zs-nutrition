-- Migration: Add soft delete support and partial unique index for MealPlan
-- This script adds a partial unique index to enforce one active plan per user
-- Run after: npx prisma db push

-- SQLite-specific syntax for partial unique index
-- Ensures only ONE active (isActive=1) and non-deleted (deletedAt IS NULL) plan per user
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_userId_active_unique"
ON "MealPlan" ("userId")
WHERE "isActive" = 1 AND "deletedAt" IS NULL;

-- Note: The deletedAt column is added via Prisma schema and db push
-- This SQL only adds the partial unique index which Prisma doesn't support natively
