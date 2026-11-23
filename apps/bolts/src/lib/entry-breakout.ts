import type { PrismaClient } from "../generated/prisma/client";
import { activeIdeaWhere } from "./ideas";
import { londonDayAfter } from "./idea-schedule";

export function entryBoltTitle(content: string) {
  return content.trim().split(/\r?\n/, 1)[0].slice(0, 200);
}

export async function moveEntryToBolt(prisma: PrismaClient, ideaId: string, entryId: string, title: string) {
  return prisma.$transaction(async (tx) => {
    const bolt = await tx.idea.create({
      data: { title, dueAt: londonDayAfter(new Date(), 1), pendingDismissal: true },
    });
    // Moving the existing row preserves attachments and rejects stale or duplicate breakouts.
    const entry = await tx.ideaEntry.update({
      where: { id: entryId, ideaId, linkedIdeaId: null, idea: activeIdeaWhere },
      data: { ideaId: bolt.id },
      select: { createdAt: true, content: true },
    });
    await tx.ideaEntry.create({
      data: { ideaId, content: entry.content, createdAt: entry.createdAt, linkedIdeaId: bolt.id },
    });
    return bolt.id;
  });
}
