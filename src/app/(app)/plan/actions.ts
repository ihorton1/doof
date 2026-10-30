"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { readMealGrid } from "@/lib/meal-days-data";
import { addDays, fromISODate, getWeekStart, MEAL_SLOTS, ENTRY_STATUSES } from "@/lib/utils";

const setEntriesSchema = z.object({
  date: z.iso.date(),
  mealSlot: z.enum(MEAL_SLOTS),
  dishIds: z.array(z.string()).max(50),
  freeformText: z.string().max(500).optional().nullable(),
});

export async function setEntries(input: z.infer<typeof setEntriesSchema>) {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) throw new Error("Sign in again before editing meals.");
  const data = setEntriesSchema.parse(input);
  const date = fromISODate(data.date);
  const weekStartDate = getWeekStart(date);
  const plan = await prisma.mealPlan.upsert({
    where: { weekStartDate },
    create: { weekStartDate },
    update: {},
  });
  const dishIds = [...new Set(data.dishIds)];
  const desiredDishIds = new Set(dishIds);
  const freeformText = (data.freeformText ?? "").trim() || null;
  const existing = await prisma.mealPlanEntry.findMany({
    where: { mealPlanId: plan.id, date, mealSlot: data.mealSlot },
    orderBy: { createdAt: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    const retainedDishIds = new Set<string>();
    let retainedFreeform = false;

    for (const entry of existing) {
      if (entry.dishId) {
        if (
          desiredDishIds.has(entry.dishId) &&
          !retainedDishIds.has(entry.dishId)
        ) {
          retainedDishIds.add(entry.dishId);
          if (entry.freeformText) {
            await tx.mealPlanEntry.update({
              where: { id: entry.id },
              data: { freeformText: null },
            });
          }
        } else {
          await tx.mealPlanEntry.delete({ where: { id: entry.id } });
        }
      } else if (freeformText && !retainedFreeform) {
        retainedFreeform = true;
        if (entry.freeformText !== freeformText) {
          await tx.mealPlanEntry.update({
            where: { id: entry.id },
            data: { freeformText },
          });
        }
      } else {
        await tx.mealPlanEntry.delete({ where: { id: entry.id } });
      }
    }

    const additions: Array<{
      mealPlanId: string;
      date: Date;
      mealSlot: (typeof MEAL_SLOTS)[number];
      dishId: string | null;
      freeformText?: string | null;
    }> = dishIds
      .filter((dishId) => !retainedDishIds.has(dishId))
      .map((dishId) => ({
        mealPlanId: plan.id,
        date,
        mealSlot: data.mealSlot,
        dishId,
      }));
    if (freeformText && !retainedFreeform) {
      additions.push({
        mealPlanId: plan.id,
        date,
        mealSlot: data.mealSlot,
        dishId: null,
        freeformText,
      });
    }
    if (additions.length > 0) {
      await tx.mealPlanEntry.createMany({ data: additions });
    }
  });

  revalidatePath("/meals");
  revalidatePath("/plan");
  revalidatePath("/shop");
  revalidatePath("/today");
  const grid = await readMealGrid(date, addDays(date, 1));
  return grid[`${data.date}|${data.mealSlot}`] ?? [];
}

const setStatusSchema = z.object({
  entryId: z.string(),
  status: z.enum(ENTRY_STATUSES),
});

export async function setEntryStatus(input: z.infer<typeof setStatusSchema>) {
  const { entryId, status } = setStatusSchema.parse(input);
  await prisma.mealPlanEntry.update({
    where: { id: entryId },
    data: {
      status,
      cookedAt: status === "cooked" ? new Date() : null,
    },
  });
  revalidatePath("/meals");
  revalidatePath("/plan");
  revalidatePath("/today");
  revalidatePath("/shop");
}
