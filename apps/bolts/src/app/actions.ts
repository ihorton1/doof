"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../generated/prisma/client";
import { entrySchema, ideaTitleSchema, type SaveState } from "../lib/ideas";
import { getPrisma } from "../lib/prisma";
import { requireSession } from "../lib/require-session";
import { appPath } from "../lib/paths";
import { redirectAfterAction } from "../lib/redirect";

export async function createIdea(_previous: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();
  const title = ideaTitleSchema.safeParse(formData.get("title"));
  if (!title.success) return { error: title.error.issues[0].message };

  let idea;
  try {
    idea = await getPrisma().idea.create({ data: { title: title.data } });
  } catch (error) {
    console.error("Bolts: could not create idea", error);
    return { error: "Your idea could not be saved. Please try again." };
  }

  revalidatePath(appPath());
  return redirectAfterAction(`/ideas/${idea.id}/`);
}

export async function addEntry(
  ideaId: string,
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireSession();
  const input = entrySchema.safeParse({ ideaId, content: formData.get("content") });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await getPrisma().idea.update({
      where: { id: input.data.ideaId },
      data: {
        updatedAt: new Date(),
        entries: { create: { content: input.data.content } },
      },
    });
  } catch (error) {
    console.error("Bolts: could not add entry", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "This idea no longer exists. Return to your ideas to start another." };
    }
    return { error: "Your entry could not be saved. Your text is still here; please try again." };
  }

  revalidatePath(appPath());
  revalidatePath(appPath(`/ideas/${input.data.ideaId}`));
  return { saved: true };
}
