ALTER TABLE "Idea" ADD COLUMN "archivedAt" TIMESTAMP(3);

DROP INDEX "Idea_deletedAt_dueAt_createdAt_id_idx";
CREATE INDEX "Idea_deletedAt_archivedAt_dueAt_createdAt_id_idx"
ON "Idea"("deletedAt", "archivedAt", "dueAt", "createdAt", "id");
