-- P5-T01: Add draftData column to MealPlan for fast-path recalculation
-- Stores MealPlanDraft (Agent 3 output) so fast-path can skip Claude re-generation
-- Nullable: only populated during full-path runs

ALTER TABLE "MealPlan" ADD COLUMN "draftData" JSONB;
