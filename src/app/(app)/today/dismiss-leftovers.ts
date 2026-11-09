"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getLeftoverWindow, type DismissLeftoversAction } from "@/lib/leftovers";
import { toISODate } from "@/lib/utils";

const dismissSchema = z.object({ entryId: z.string().trim().min(1).max(200) });

export const dismissLeftovers: DismissLeftoversAction = async (input) => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before clearing leftovers." };

  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a meal to clear its leftovers." };

  try {
    const result = await prisma.mealPlanEntry.updateMany({
      where: {
        id: parsed.data.entryId,
        date: getLeftoverWindow(toISODate(new Date())),
        mealSlot: "dinner",
        dishId: { not: null },
        status: { not: "skipped" },
      },
      data: { leftoversDismissed: true },
    });
    if (!result.count) return { error: "This meal is no longer available as leftovers. Refresh Today." };
    revalidatePath("/today");
    return { status: "dismissed" };
  } catch (error) {
    console.error("Failed to dismiss leftovers", error);
    return { error: "Could not clear these leftovers. Please try again." };
  }
};
