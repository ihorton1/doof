import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { MAX_ENTRY_IMAGES } from "./entry-images";
import { parseEntryContent } from "./entry-todos";

export const ideaTitleSchema = z.string()
  .trim()
  .max(200, "Keep the title to 200 characters or fewer.");

export function ideaLabel(title: string) {
  return title || "Untitled bolt";
}

export const ideaIdSchema = z.cuid("This idea could not be found. Return to your ideas and try again.");

export const activeIdeaWhere = { deletedAt: null } satisfies Prisma.IdeaWhereInput;

export const entryDraftSchema = z.object({
  content: z.string()
    .trim()
    .max(20000, "Keep each entry to 20,000 characters or fewer."),
  imageCount: z.number().int().min(0).max(MAX_ENTRY_IMAGES).default(0),
}).refine((entry) => parseEntryContent(entry.content).content.length > 0 || entry.imageCount > 0, {
  message: "Write something or paste an image to add to this idea.",
  path: ["content"],
});

export const entrySchema = entryDraftSchema.safeExtend({ ideaId: ideaIdSchema });

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
      linkedIdeaId: true,
      isTodo: true,
      completedAt: true,
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
  entries: { id: string; content: string; linkedIdeaId: string | null; isTodo: boolean; completedAt: Date | null; createdAt: Date; images: { id: string }[] }[];
};
