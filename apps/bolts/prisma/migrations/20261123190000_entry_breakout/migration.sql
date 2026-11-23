ALTER TABLE "IdeaEntry" ADD COLUMN "linkedIdeaId" TEXT;
CREATE INDEX "IdeaEntry_linkedIdeaId_idx" ON "IdeaEntry"("linkedIdeaId");
ALTER TABLE "IdeaEntry" ADD CONSTRAINT "IdeaEntry_linkedIdeaId_fkey"
  FOREIGN KEY ("linkedIdeaId") REFERENCES "Idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
