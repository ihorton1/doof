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

const upsertSchema = z.object({
  weekStart: z.string(),
  date: z.string(),
  mealSlot: z.enum(MEAL_SLOTS),
  dishId: z.string().optional().nullable(),
  freeformText: z.string().max(500).optional().nullable(),
});

export async function upsertEntry(input: z.infer<typeof upsertSchema>) {
  const data = upsertSchema.parse(input);
  const plan = await getOrCreatePlan(data.weekStart);
  const date = fromISODate(data.date);

  // One entry per (plan, date, slot). Find existing.
  const existing = await prisma.mealPlanEntry.findFirst({
    where: { mealPlanId: plan.id, date, mealSlot: data.mealSlot },
  });

  const dishId = data.dishId || null;
  const freeformText = (data.freeformText ?? "").trim() || null;

  if (!dishId && !freeformText) {
    if (existing) {
      await prisma.mealPlanEntry.delete({ where: { id: existing.id } });
    }
  } else if (existing) {
    await prisma.mealPlanEntry.update({
      where: { id: existing.id },
      data: {
        dishId,
        freeformText,
        // Reset status when changing what's planned
        status: existing.status === "skipped" ? "skipped" : "planned",
        cookedAt: null,
      },
    });
  } else {
    await prisma.mealPlanEntry.create({
      data: {
        mealPlanId: plan.id,
        date,
        mealSlot: data.mealSlot,
        dishId,
        freeformText,
      },
    });
  }

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
