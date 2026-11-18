import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";

export const ideaTitleSchema = z.string()
  .trim()
  .min(1, "Give your idea a title.")
  .max(200, "Keep the title to 200 characters or fewer.");

export const ideaIdSchema = z.cuid("This idea could not be found. Return to your ideas and try again.");

export const activeIdeaWhere = { deletedAt: null } satisfies Prisma.IdeaWhereInput;

export const entrySchema = z.object({
  ideaId: ideaIdSchema,
  content: z.string()
    .trim()
    .min(1, "Write something to add to this idea.")
    .max(20000, "Keep each entry to 20,000 characters or fewer."),
});

export type SaveState = {
  error?: string;
  saved?: boolean;
};

export const ideaFeedSelect = {
  id: true,
  title: true,
  _count: { select: { entries: true } },
  entries: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: { content: true, createdAt: true },
  },
} satisfies Prisma.IdeaSelect;

export type IdeaSummary = Prisma.IdeaGetPayload<{ select: typeof ideaFeedSelect }>;

export type IdeaDetail = {
  id: string;
  title: string;
  entries: { id: string; content: string; createdAt: Date }[];
};
