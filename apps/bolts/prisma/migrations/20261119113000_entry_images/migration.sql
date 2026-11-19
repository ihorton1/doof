CREATE TABLE "IdeaEntryImage" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "contentType" VARCHAR(32) NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "IdeaEntryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdeaEntryImage_entryId_position_key" ON "IdeaEntryImage"("entryId", "position");

ALTER TABLE "IdeaEntryImage" ADD CONSTRAINT "IdeaEntryImage_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "IdeaEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
