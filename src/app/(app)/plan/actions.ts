"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, MEAL_SLOTS, ENTRY_STATUSES } from "@/lib/utils";

async function getOrCreatePlan(weekStartIso: string) {
  const weekStart = fromISODate(weekStartIso);
  const existing = await prisma.mealPlan.findUnique({
    where: { weekStartDate: weekStart },
  });
  if (existing) return existing;
  return prisma.mealPlan.create({ data: { weekStartDate: weekStart } });
}

const setEntriesSchema = z.object({
  weekStart: z.string(),
  date: z.string(),
  mealSlot: z.enum(MEAL_SLOTS),
  dishIds: z.array(z.string()).max(50),
  freeformText: z.string().max(500).optional().nullable(),
});

export async function setEntries(input: z.infer<typeof setEntriesSchema>) {
  const data = setEntriesSchema.parse(input);
  const plan = await getOrCreatePlan(data.weekStart);
  const date = fromISODate(data.date);
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

  revalidatePath("/plan");
  revalidatePath("/shop");
  revalidatePath("/today");
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
  revalidatePath("/plan");
  revalidatePath("/today");
}
