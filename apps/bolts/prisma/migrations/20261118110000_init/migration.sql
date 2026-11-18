CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdeaEntry" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdeaEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdeaEntry_ideaId_createdAt_idx" ON "IdeaEntry"("ideaId", "createdAt");

ALTER TABLE "IdeaEntry" ADD CONSTRAINT "IdeaEntry_ideaId_fkey"
FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
