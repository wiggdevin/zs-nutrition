-- Partial index for quickly finding active (pending/running) jobs per user.
-- Covers the common "is there already a running job for this user?" check.
CREATE INDEX IF NOT EXISTS "PlanGenerationJob_userId_active_idx"
  ON "PlanGenerationJob" ("userId")
  WHERE status IN ('pending', 'running');
