import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { MAX_ENTRY_IMAGES } from "./entry-images";

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
    .max(20000, "Keep each entry to 20,000 characters or fewer."),
  imageCount: z.number().int().min(0).max(MAX_ENTRY_IMAGES).default(0),
}).refine((entry) => entry.content.length > 0 || entry.imageCount > 0, {
  message: "Write something or paste an image to add to this idea.",
  path: ["content"],
});

export type SaveState = {
  error?: string;
  saved?: boolean;
};

export const ideaFeedSelect = {
  id: true,
  title: true,
  dueAt: true,
  createdAt: true,
  snoozeCount: true,
  archivedAt: true,
  _count: { select: { entries: true } },
  entries: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      content: true,
      createdAt: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  },
} satisfies Prisma.IdeaSelect;

export type IdeaSummary = Prisma.IdeaGetPayload<{ select: typeof ideaFeedSelect }>;

export type IdeaDetail = {
  id: string;
  title: string;
  pendingDismissal: boolean;
  archivedAt: Date | null;
  entries: { id: string; content: string; createdAt: Date; images: { id: string }[] }[];
};
