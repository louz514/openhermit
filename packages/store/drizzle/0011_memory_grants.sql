ALTER TABLE "memories" ADD COLUMN "grants" jsonb DEFAULT '[]'::jsonb NOT NULL;
