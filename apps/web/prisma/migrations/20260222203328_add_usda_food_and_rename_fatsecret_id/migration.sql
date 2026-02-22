-- Rename fatsecretId → foodId (preserves existing data)
ALTER TABLE "TrackedMeal" RENAME COLUMN "fatsecretId" TO "foodId";

-- CreateTable
CREATE TABLE "UsdaFood" (
    "fdcId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "nutrients" JSONB NOT NULL,
    "portions" JSONB NOT NULL,

    CONSTRAINT "UsdaFood_pkey" PRIMARY KEY ("fdcId")
);

-- Add generated tsvector column for full-text search
ALTER TABLE "UsdaFood"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "description")) STORED;

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisWindow" INTEGER NOT NULL DEFAULT 14,
    "insights" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "tokenUsage" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsdaFood_dataType_idx" ON "UsdaFood"("dataType");

-- CreateIndex
CREATE INDEX "UsdaFood_searchVector_idx" ON "UsdaFood" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "AiInsight_userId_expiresAt_idx" ON "AiInsight"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AiInsight_userId_generatedAt_idx" ON "AiInsight"("userId", "generatedAt");

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
