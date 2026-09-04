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
  revalidatePath("/shop");
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
  revalidatePath("/shop");
}

export async function deleteBoxItem(itemId: string) {
  await prisma.produceBoxItem.delete({ where: { id: itemId } });
  revalidatePath("/shop");
}

const toggleSchema = z.object({
  itemId: z.string(),
  checked: z.boolean(),
});

export async function toggleBoxItem(input: z.infer<typeof toggleSchema>) {
  const { itemId, checked } = toggleSchema.parse(input);
  await prisma.produceBoxItem.update({
    where: { id: itemId },
    data: {
      checked,
      checkedAt: checked ? new Date() : null,
    },
  });
  revalidatePath("/shop");
}

const carrySchema = z.object({ weekStart: z.string() });

export async function carryOverUncheckedItems(
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
        orderBy: { position: "asc" },
      },
    },
  });
  if (!fromBox) return { carried: 0 };

  const unchecked = fromBox.items.filter((i) => !i.checked);
  if (unchecked.length === 0) return { carried: 0 };

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
      carriedFromId: { in: unchecked.map((i) => i.id) },
    },
    select: { carriedFromId: true },
  });
  const alreadyCarried = new Set(existing.map((e) => e.carriedFromId));

  const toCreate = unchecked.filter((i) => !alreadyCarried.has(i.id));
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

  revalidatePath("/shop");
  return { carried: toCreate.length };
}
