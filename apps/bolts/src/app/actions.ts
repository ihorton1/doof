"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../generated/prisma/client";
import { activeIdeaWhere, entrySchema, ideaIdSchema, ideaTitleSchema, type SaveState } from "../lib/ideas";
import { getPrisma } from "../lib/prisma";
import { requireSession } from "../lib/require-session";
import { appPath } from "../lib/paths";
import { redirectAfterAction } from "../lib/redirect";
import { londonDayAfter, snoozeDays, SNOOZE_DAYS } from "../lib/idea-schedule";
import { getIdeaPage, ideaPageRequestSchema, type IdeaPageResult } from "../lib/idea-feed";
import { imageContentType, validateEntryImages } from "../lib/entry-images";

export async function createIdea(_previous: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();
  const title = ideaTitleSchema.safeParse(formData.get("title"));
  if (!title.success) return { error: title.error.issues[0].message };

  let idea;
  try {
    idea = await getPrisma().idea.create({ data: { title: title.data, dueAt: londonDayAfter(new Date(), 1) } });
  } catch (error) {
    console.error("Bolts: could not create idea", error);
    return { error: "Your idea could not be saved. Please try again." };
  }

  revalidatePath(appPath());
  revalidatePath(appPath("/search"));
  return redirectAfterAction(`/ideas/${idea.id}/`);
}

export async function addEntry(
  ideaId: string,
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireSession();
  const attachments = formData.getAll("images");
  if (attachments.some((attachment) => !(attachment instanceof File))) {
    return { error: "Paste PNG, JPEG, GIF or WebP images." };
  }
  const files = attachments.filter((attachment): attachment is File => attachment instanceof File);
  const imageError = validateEntryImages(files);
  if (imageError) return { error: imageError };
  const input = entrySchema.safeParse({ ideaId, content: formData.get("content"), imageCount: files.length });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    const images: Prisma.IdeaEntryImageCreateWithoutEntryInput[] = [];
    for (const [position, file] of files.entries()) {
      const data = new Uint8Array(await file.arrayBuffer());
      const contentType = imageContentType(data);
      if (!contentType || contentType !== file.type) {
        return { error: "An image could not be read as PNG, JPEG, GIF or WebP. Paste another image." };
      }
      images.push({ data, contentType, position });
    }
    await getPrisma().idea.update({
      where: { id: input.data.ideaId, ...activeIdeaWhere },
      data: {
        updatedAt: new Date(),
        pendingDismissal: true,
        entries: { create: {
          content: input.data.content,
          ...(images.length > 0 ? { images: { create: images } } : {}),
        } },
      },
    });
  } catch (error) {
    console.error("Bolts: could not add entry", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "This idea no longer exists. Return to your ideas to start another." };
    }
    return { error: "Your entry could not be saved. Your text and images are still here; please try again." };
  }

  revalidatePath(appPath());
  revalidatePath(appPath("/search"));
  revalidatePath(appPath(`/ideas/${input.data.ideaId}`));
  return { saved: true };
}

export async function deleteIdea(ideaId: string): Promise<SaveState> {
  await requireSession();
  const input = ideaIdSchema.safeParse(ideaId);
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await getPrisma().idea.update({
      where: { id: input.data, ...activeIdeaWhere },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    console.error("Bolts: could not delete idea", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "This idea has already been deleted or no longer exists. Return to your bolts." };
    }
    return { error: "Your idea could not be deleted. Please try again." };
  }

  revalidatePath(appPath());
  revalidatePath(appPath("/search"));
  revalidatePath(appPath(`/ideas/${input.data}`));
  return redirectAfterAction("/");
}

export async function loadIdeaPage(input: unknown): Promise<IdeaPageResult> {
  await requireSession();
  const request = ideaPageRequestSchema.safeParse(input);
  if (!request.success) return { error: "This list could not be loaded. Refresh the page and try again." };
  try {
    return { page: await getIdeaPage(request.data) };
  } catch (error) {
    console.error("Bolts: could not load ideas", error);
    return { error: "Your bolts could not be loaded. Please try again." };
  }
}

async function rescheduleIdea(ideaId: string, operation: "snooze" | "dismiss", expectedDueAt?: string): Promise<SaveState> {
  const input = ideaIdSchema.safeParse(ideaId);
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const prisma = getPrisma();
    const idea = await prisma.idea.findUnique({ where: { id: input.data, ...activeIdeaWhere } });
    if (!idea) return { error: "This idea no longer exists. Return to your bolts." };
    if (idea.archivedAt) return { error: "This bolt is archived. Reactivate it before changing its schedule." };
    const now = new Date();
    if (operation === "snooze" && (idea.dueAt.toISOString() !== expectedDueAt || idea.dueAt > now)) {
      return { error: "This bolt's schedule has changed. Refresh the page before snoozing it." };
    }
    if (operation === "dismiss" && !idea.pendingDismissal) {
      return { error: "Add an entry before marking this bolt done for now." };
    }
    const result = await prisma.idea.updateMany({
      where: {
        id: idea.id,
        ...activeIdeaWhere,
        archivedAt: null,
        dueAt: idea.dueAt,
        snoozeCount: idea.snoozeCount,
        updatedAt: idea.updatedAt,
        pendingDismissal: idea.pendingDismissal,
      },
      data: {
        dueAt: londonDayAfter(now, operation === "dismiss" ? 1 : snoozeDays(idea.snoozeCount)),
        snoozeCount: operation === "dismiss" ? 0 : Math.min(idea.snoozeCount + 1, SNOOZE_DAYS.length - 1),
        pendingDismissal: false,
      },
    });
    if (result.count !== 1) return { error: "This bolt changed while you were viewing it. Refresh the page and try again." };
  } catch (error) {
    console.error(`Bolts: could not ${operation} idea`, error);
    return { error: "This bolt's schedule could not be saved. Please try again." };
  }
  revalidatePath(appPath());
  revalidatePath(appPath("/search"));
  revalidatePath(appPath(`/ideas/${input.data}`));
  return { saved: true };
}

export async function snoozeIdea(ideaId: string, expectedDueAt: string): Promise<SaveState> {
  await requireSession();
  return rescheduleIdea(ideaId, "snooze", expectedDueAt);
}

export async function dismissIdea(ideaId: string): Promise<SaveState> {
  await requireSession();
  const result = await rescheduleIdea(ideaId, "dismiss");
  if (result.error) return result;
  return redirectAfterAction("/");
}

async function setIdeaArchived(ideaId: string, archived: boolean): Promise<SaveState> {
  const input = ideaIdSchema.safeParse(ideaId);
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const now = new Date();
    const result = await getPrisma().idea.updateMany({
      where: {
        id: input.data,
        ...activeIdeaWhere,
        archivedAt: archived ? null : { not: null },
      },
      data: archived
        ? { archivedAt: now, pendingDismissal: false }
        : { archivedAt: null, dueAt: now, snoozeCount: 0, pendingDismissal: false },
    });
    if (result.count !== 1) return { error: "This bolt changed or no longer exists. Refresh the page and try again." };
  } catch (error) {
    console.error(`Bolts: could not ${archived ? "archive" : "reactivate"} idea`, error);
    return { error: `This bolt could not be ${archived ? "archived" : "reactivated"}. Please try again.` };
  }
  revalidatePath(appPath());
  revalidatePath(appPath("/search"));
  revalidatePath(appPath(`/ideas/${input.data}`));
  return { saved: true };
}

export async function archiveIdea(ideaId: string): Promise<SaveState> {
  await requireSession();
  return setIdeaArchived(ideaId, true);
}

export async function reactivateIdea(ideaId: string): Promise<SaveState> {
  await requireSession();
  return setIdeaArchived(ideaId, false);
}
