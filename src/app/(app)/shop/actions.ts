"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRollingList, requireShoppingSession } from "@/lib/shopping-data";
import { fromISODate, categorize } from "@/lib/utils";

async function getList(weekStart?: string) {
  if (!weekStart) return getRollingList();
  const weekStartDate = fromISODate(weekStart);
  return prisma.shoppingList.upsert({
    where: { weekStartDate }, create: { weekStartDate }, update: {},
  });
}

const addItemSchema = z.object({
  weekStart: z.iso.date().optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(50).optional().nullable(),
  unit: z.string().trim().max(50).optional().nullable(),
});

export async function addManualItem(input: z.infer<typeof addItemSchema>) {
  await requireShoppingSession();
  const data = addItemSchema.parse(input);
  const list = await getList(data.weekStart);
  const max = await prisma.shoppingListItem.aggregate({
    where: { shoppingListId: list.id }, _max: { position: true },
  });
  await prisma.shoppingListItem.create({
    data: {
      shoppingListId: list.id, name: data.name,
      quantity: data.quantity || null, unit: data.unit || null,
      category: categorize(data.name), source: "manual",
      position: (max._max.position ?? 0) + 1,
    },
  });
  revalidatePath("/shop");
  revalidatePath("/meals");
}

const toggleManySchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  checked: z.boolean(),
});

export async function toggleItems(input: z.infer<typeof toggleManySchema>) {
  await requireShoppingSession();
  const { itemIds, checked } = toggleManySchema.parse(input);
  await prisma.shoppingListItem.updateMany({
    where: { id: { in: itemIds } },
    data: { checked, checkedAt: checked ? new Date() : null },
  });
  revalidatePath("/shop");
}

const deleteManySchema = z.object({ itemIds: z.array(z.string().min(1)).min(1) });

export async function deleteItems(input: z.infer<typeof deleteManySchema>) {
  await requireShoppingSession();
  const { itemIds } = deleteManySchema.parse(input);
  await prisma.$transaction([
    prisma.shoppingListItem.updateMany({
      where: { id: { in: itemIds }, source: "auto" }, data: { dismissed: true },
    }),
    prisma.shoppingListItem.deleteMany({
      where: { id: { in: itemIds }, source: "manual" },
    }),
  ]);
  revalidatePath("/shop");
  revalidatePath("/meals");
}

export async function deleteItem(itemId: string) {
  await deleteItems({ itemIds: [itemId] });
}

export async function clearChecked() {
  await requireShoppingSession();
  const list = await getRollingList();
  await prisma.$transaction([
    prisma.shoppingListItem.updateMany({
      where: { shoppingListId: list.id, source: "auto", checked: true },
      data: { dismissed: true },
    }),
    prisma.shoppingListItem.deleteMany({
      where: { shoppingListId: list.id, source: "manual", checked: true },
    }),
  ]);
  revalidatePath("/shop");
}
