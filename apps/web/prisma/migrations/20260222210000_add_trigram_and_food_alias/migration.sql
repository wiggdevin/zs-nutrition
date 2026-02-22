-- Enable pg_trgm extension for fuzzy/trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram GIN index on UsdaFood.description for fuzzy matching
CREATE INDEX "UsdaFood_description_trgm_idx"
  ON "UsdaFood" USING GIN ("description" gin_trgm_ops);

-- Create FoodAlias table for data-driven ingredient name mapping
CREATE TABLE "FoodAlias" (
    "alias"         TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "usdaFdcId"     INTEGER,
    "priority"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodAlias_pkey" PRIMARY KEY ("alias"),
    CONSTRAINT "FoodAlias_usdaFdcId_fkey"
      FOREIGN KEY ("usdaFdcId") REFERENCES "UsdaFood"("fdcId")
      ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index for reverse lookups by canonical name
CREATE INDEX "FoodAlias_canonicalName_idx" ON "FoodAlias"("canonicalName");
