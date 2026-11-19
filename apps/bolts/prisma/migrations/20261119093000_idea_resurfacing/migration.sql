ALTER TABLE "Idea"
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "snoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pendingDismissal" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Idea" SET "dueAt" = "createdAt";

ALTER TABLE "Idea"
ALTER COLUMN "dueAt" SET NOT NULL,
ALTER COLUMN "dueAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Idea_deletedAt_dueAt_createdAt_id_idx"
ON "Idea"("deletedAt", "dueAt", "createdAt", "id");
