"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { addDays, fromISODate, toISODate } from "@/lib/utils";

async function getOrCreateBox(weekStartIso: string) {
  const weekStart = fromISODate(weekStartIso);
  const existing = await prisma.produceBox.findUnique({
    where: { weekStartDate: weekStart },
  });
  if (existing) return existing;
  return prisma.produceBox.create({ data: { weekStartDate: weekStart } });
}

const addItemSchema = z.object({
  weekStart: z.string(),
  name: z.string().min(1).max(120),
  quantity: z.string().max(40).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function addBoxItem(input: z.infer<typeof addItemSchema>) {
  const data = addItemSchema.parse(input);
  const box = await getOrCreateBox(data.weekStart);
  const last = await prisma.produceBoxItem.findFirst({
    where: { produceBoxId: box.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await prisma.produceBoxItem.create({
    data: {
      produceBoxId: box.id,
      name: data.name.trim(),
      quantity: data.quantity?.trim() || null,
      unit: data.unit?.trim() || null,
      notes: data.notes?.trim() || null,
      position: (last?.position ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
}

const updateItemSchema = z.object({
  itemId: z.string(),
  name: z.string().min(1).max(120).optional(),
  quantity: z.string().max(40).nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function updateBoxItem(input: z.infer<typeof updateItemSchema>) {
  const { itemId, ...rest } = updateItemSchema.parse(input);
  const data: Record<string, unknown> = {};
  if (rest.name !== undefined) data.name = rest.name.trim();
  if (rest.quantity !== undefined) data.quantity = rest.quantity?.trim() || null;
  if (rest.unit !== undefined) data.unit = rest.unit?.trim() || null;
  if (rest.notes !== undefined) data.notes = rest.notes?.trim() || null;
  await prisma.produceBoxItem.update({ where: { id: itemId }, data });
  revalidatePath("/plan");
}

export async function deleteBoxItem(itemId: string) {
  await prisma.produceBoxItem.delete({ where: { id: itemId } });
  revalidatePath("/plan");
}

const linkSchema = z.object({
  itemId: z.string(),
  mealPlanEntryId: z.string(),
});

export async function linkBoxItem(input: z.infer<typeof linkSchema>) {
  const { itemId, mealPlanEntryId } = linkSchema.parse(input);
  // Idempotent thanks to the @@unique constraint.
  await prisma.produceBoxItemLink.upsert({
    where: {
      produceBoxItemId_mealPlanEntryId: {
        produceBoxItemId: itemId,
        mealPlanEntryId,
      },
    },
    create: { produceBoxItemId: itemId, mealPlanEntryId },
    update: {},
  });
  revalidatePath("/plan");
}

export async function unlinkBoxItem(input: z.infer<typeof linkSchema>) {
  const { itemId, mealPlanEntryId } = linkSchema.parse(input);
  await prisma.produceBoxItemLink.deleteMany({
    where: { produceBoxItemId: itemId, mealPlanEntryId },
  });
  revalidatePath("/plan");
}

const carrySchema = z.object({ weekStart: z.string() });

export async function carryOverUncoveredItems(
  input: z.infer<typeof carrySchema>,
) {
  const { weekStart } = carrySchema.parse(input);
  const fromWeekStart = fromISODate(weekStart);
  const toWeekStartIso = toISODate(addDays(fromWeekStart, 7));
  const toWeekStart = fromISODate(toWeekStartIso);

  const fromBox = await prisma.produceBox.findUnique({
    where: { weekStartDate: fromWeekStart },
    include: {
      items: {
        include: { _count: { select: { links: true } } },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!fromBox) return { carried: 0 };

  const uncovered = fromBox.items.filter((i) => i._count.links === 0);
  if (uncovered.length === 0) return { carried: 0 };

  const toBox = await prisma.produceBox.upsert({
    where: { weekStartDate: toWeekStart },
    create: { weekStartDate: toWeekStart },
    update: {},
  });

  const last = await prisma.produceBoxItem.findFirst({
    where: { produceBoxId: toBox.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let nextPos = (last?.position ?? -1) + 1;

  // Skip items that were already carried from each source id (don't double-copy).
  const existing = await prisma.produceBoxItem.findMany({
    where: {
      produceBoxId: toBox.id,
      carriedFromId: { in: uncovered.map((i) => i.id) },
    },
    select: { carriedFromId: true },
  });
  const alreadyCarried = new Set(existing.map((e) => e.carriedFromId));

  const toCreate = uncovered.filter((i) => !alreadyCarried.has(i.id));
  if (toCreate.length === 0) return { carried: 0 };

  await prisma.produceBoxItem.createMany({
    data: toCreate.map((i) => ({
      produceBoxId: toBox.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      position: nextPos++,
      carriedFromId: i.id,
    })),
  });

  revalidatePath("/plan");
  return { carried: toCreate.length };
}
