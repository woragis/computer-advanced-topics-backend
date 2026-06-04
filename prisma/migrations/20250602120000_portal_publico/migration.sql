-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('URL', 'TEXT');

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "display_url" TEXT,
    "snippet" TEXT,
    "first_submitted_by_id" UUID NOT NULL,
    "first_analyzed_at" TIMESTAMP(3) NOT NULL,
    "last_analyzed_at" TIMESTAMP(3) NOT NULL,
    "analysis_count" INTEGER NOT NULL DEFAULT 1,
    "latest_analysis_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add portal columns to analyses (nullable first for backfill)
ALTER TABLE "analyses" ADD COLUMN "content_item_id" UUID;
ALTER TABLE "analyses" ADD COLUMN "version_number" INTEGER NOT NULL DEFAULT 1;

-- Backfill content_items from existing analyses
INSERT INTO "content_items" (
    "id",
    "kind",
    "canonical_key",
    "display_url",
    "snippet",
    "first_submitted_by_id",
    "first_analyzed_at",
    "last_analyzed_at",
    "analysis_count",
    "latest_analysis_id",
    "created_at"
)
SELECT
    gen_random_uuid(),
    CASE WHEN a."input_url" IS NOT NULL AND trim(a."input_url") <> '' THEN 'URL'::"ContentKind" ELSE 'TEXT'::"ContentKind" END,
    CASE
        WHEN a."input_url" IS NOT NULL AND trim(a."input_url") <> '' THEN 'url:' || lower(trim(a."input_url"))
        ELSE 'text:legacy-' || a."id"::text
    END,
    NULLIF(trim(a."input_url"), ''),
    left(COALESCE(a."raw_text", a."input_text", a."input_url", ''), 220),
    a."user_id",
    a."created_at",
    a."created_at",
    1,
    a."id",
    a."created_at"
FROM "analyses" a;

-- Link analyses to their content_items
UPDATE "analyses" a
SET
    "content_item_id" = c."id",
    "version_number" = 1
FROM "content_items" c
WHERE c."latest_analysis_id" = a."id";

-- Enforce NOT NULL
ALTER TABLE "analyses" ALTER COLUMN "content_item_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "content_items_canonical_key_key" ON "content_items"("canonical_key");
CREATE UNIQUE INDEX "content_items_latest_analysis_id_key" ON "content_items"("latest_analysis_id");
CREATE INDEX "content_items_last_analyzed_at_idx" ON "content_items"("last_analyzed_at" DESC);
CREATE INDEX "analyses_content_item_id_idx" ON "analyses"("content_item_id");
CREATE INDEX "analyses_content_item_id_version_number_idx" ON "analyses"("content_item_id", "version_number");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_first_submitted_by_id_fkey" FOREIGN KEY ("first_submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_latest_analysis_id_fkey" FOREIGN KEY ("latest_analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
