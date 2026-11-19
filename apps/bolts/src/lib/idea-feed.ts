import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { activeIdeaWhere, ideaFeedSelect, ideaIdSchema, type IdeaSummary } from "./ideas";
import { getPrisma } from "./prisma";

export const IDEA_PAGE_SIZE = 10;
export const searchQuerySchema = z.string().trim().max(200, "Keep your search to 200 characters or fewer.");
export const ideaCursorSchema = z.object({
  dueAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  id: ideaIdSchema,
});
export type IdeaCursor = z.infer<typeof ideaCursorSchema>;

export const ideaPageRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("due"), asOf: z.iso.datetime(), cursor: ideaCursorSchema.nullable() }),
  z.object({ kind: z.literal("search"), query: searchQuerySchema.min(1, "Enter a title or some entry text."), cursor: ideaCursorSchema.nullable() }),
]);
export type IdeaPageRequest = z.infer<typeof ideaPageRequestSchema>;
export type IdeaPage = { ideas: IdeaSummary[]; nextCursor: IdeaCursor | null };
export type IdeaPageResult = { page: IdeaPage; error?: never } | { error: string; page?: never };

export function ideaPageArgs(request: IdeaPageRequest) {
  const filters: Prisma.IdeaWhereInput[] = [activeIdeaWhere];
  if (request.kind === "due") {
    filters.push({ archivedAt: null, dueAt: { lte: new Date(request.asOf) } });
  } else {
    const literal = request.query.replace(/[\\%_]/g, "\\$&");
    filters.push({
      OR: [
        { title: { contains: literal, mode: "insensitive" } },
        { entries: { some: { content: { contains: literal, mode: "insensitive" } } } },
      ],
    });
  }
  if (request.cursor) {
    const { dueAt, createdAt, id } = request.cursor;
    filters.push({
      OR: [
        { dueAt: { gt: new Date(dueAt) } },
        { dueAt: new Date(dueAt), createdAt: { gt: new Date(createdAt) } },
        { dueAt: new Date(dueAt), createdAt: new Date(createdAt), id: { gt: id } },
      ],
    });
  }
  return {
    where: { AND: filters },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: IDEA_PAGE_SIZE + 1,
    select: ideaFeedSelect,
  } satisfies Prisma.IdeaFindManyArgs;
}

export async function getIdeaPage(request: IdeaPageRequest): Promise<IdeaPage> {
  const rows = await getPrisma().idea.findMany(ideaPageArgs(request));
  const ideas = rows.slice(0, IDEA_PAGE_SIZE);
  const last = ideas.at(-1);
  return {
    ideas,
    nextCursor: rows.length > IDEA_PAGE_SIZE && last ? {
      dueAt: last.dueAt.toISOString(),
      createdAt: last.createdAt.toISOString(),
      id: last.id,
    } : null,
  };
}
