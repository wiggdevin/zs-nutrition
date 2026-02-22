-- CreateIndex
CREATE INDEX "TrackedMeal_userId_loggedDate_createdAt_idx" ON "TrackedMeal"("userId", "loggedDate", "createdAt");

-- CreateIndex
CREATE INDEX "ActivitySync_userId_platform_syncDate_idx" ON "ActivitySync"("userId", "platform", "syncDate");
