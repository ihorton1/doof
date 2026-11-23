-- Restore automatic link labels only when the original moved entry is unambiguous.
WITH originals AS (
  SELECT link."id", MIN(original."content") AS content
  FROM "IdeaEntry" link
  JOIN "Idea" target ON target."id" = link."linkedIdeaId"
  JOIN "IdeaEntry" original
    ON original."ideaId" = link."linkedIdeaId"
    AND original."createdAt" = link."createdAt"
    AND original."linkedIdeaId" IS NULL
  WHERE link."content" = target."title" OR link."content" = 'Untitled bolt'
  GROUP BY link."id"
  HAVING COUNT(*) = 1
)
UPDATE "IdeaEntry" link
SET "content" = originals.content
FROM originals
WHERE link."id" = originals."id";
