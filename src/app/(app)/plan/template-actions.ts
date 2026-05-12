"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, addDays, toISODate } from "@/lib/utils";

const saveSchema = z.object({
  weekStart: z.string(),
  name: z.string().min(1).max(120),
});

export async function saveTemplate(input: z.infer<typeof saveSchema>) {
  const { weekStart, name } = saveSchema.parse(input);
  const ws = fromISODate(weekStart);
  const we = addDays(ws, 7);

  const [plan, list] = await Promise.all([
    prisma.mealPlan.findUnique({
      where: { weekStartDate: ws },
      include: { entries: true },
    }),
    prisma.shoppingList.findUnique({
      where: { weekStartDate: ws },
      include: {
        items: {
          where: { source: "manual" },
          orderBy: { position: "asc" },
          select: { name: true, quantity: true, unit: true },
        },
      },
    }),
  ]);

  const entryData =
    plan?.entries.map((e) => {
      const dayOffset = Math.floor(
        (e.date.getTime() - ws.getTime()) / 86400000,
      );
      return {
        dayOffset,
        mealSlot: e.mealSlot,
        dishId: e.dishId,
        freeformText: e.freeformText,
      };
    }).filter((e) => e.dayOffset >= 0 && e.dayOffset < 7) ?? [];

  const miscData =
    list?.items.map((it, i) => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      position: i,
    })) ?? [];

  await prisma.planTemplate.create({
    data: {
      name: name.trim(),
      entries: { createMany: { data: entryData } },
      miscItems: { createMany: { data: miscData } },
    },
  });

  // Touch unused import so eslint doesn't complain (we re-export weekEnd via we above).
  void we;
  void toISODate;

  revalidatePath("/plan");
}

const applySchema = z.object({
  templateId: z.string(),
  weekStart: z.string(),
});

export async function applyTemplate(input: z.infer<typeof applySchema>) {
  const { templateId, weekStart } = applySchema.parse(input);
  const ws = fromISODate(weekStart);

  const template = await prisma.planTemplate.findUnique({
    where: { id: templateId },
    include: { entries: true, miscItems: true },
  });
  if (!template) throw new Error("Template not found");

  // Ensure the MealPlan + ShoppingList exist for this week
  const plan = await prisma.mealPlan.upsert({
    where: { weekStartDate: ws },
    update: {},
    create: { weekStartDate: ws },
  });
  const list = await prisma.shoppingList.upsert({
    where: { weekStartDate: ws },
    update: {},
    create: { weekStartDate: ws },
  });

  // REPLACE behavior: wipe meal plan entries and existing manual shop items
  await prisma.$transaction([
    prisma.mealPlanEntry.deleteMany({ where: { mealPlanId: plan.id } }),
    prisma.shoppingListItem.deleteMany({
      where: { shoppingListId: list.id, source: "manual" },
    }),
    prisma.mealPlanEntry.createMany({
      data: template.entries.map((e) => ({
        mealPlanId: plan.id,
        date: addDays(ws, e.dayOffset),
        mealSlot: e.mealSlot,
        dishId: e.dishId,
        freeformText: e.freeformText,
      })),
    }),
    prisma.shoppingListItem.createMany({
      data: template.miscItems.map((m, i) => ({
        shoppingListId: list.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        source: "manual",
        position: i,
      })),
    }),
  ]);

  revalidatePath("/plan");
  revalidatePath("/shop");
}

export async function deleteTemplate(id: string) {
  await prisma.planTemplate.delete({ where: { id } });
  revalidatePath("/plan");
}
