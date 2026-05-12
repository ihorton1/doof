"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromISODate, categorize } from "@/lib/utils";

async function getOrCreateList(weekStartIso: string) {
  const weekStart = fromISODate(weekStartIso);
  const existing = await prisma.shoppingList.findUnique({
    where: { weekStartDate: weekStart },
  });
  if (existing) return existing;
  return prisma.shoppingList.create({ data: { weekStartDate: weekStart } });
}

/**
 * Aggregate ingredients from all "planned" or "cooked" entries that have a
 * dish in the given week, then merge with existing manual items.
 *
 * Strategy:
 *  - Auto items (source=auto) are regenerated from the meal plan every time.
 *  - Manual items (source=manual) are preserved, including their checked state.
 *  - For auto items, we preserve `checked` if a same-name+unit auto item exists.
 */
export async function generateShoppingList(
  weekStartIso: string,
  mode: "aisle" | "dish" = "aisle",
) {
  const list = await getOrCreateList(weekStartIso);
  const weekStart = fromISODate(weekStartIso);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      date: { gte: weekStart, lt: weekEnd },
      status: { in: ["planned", "cooked"] },
      dishId: { not: null },
    },
    include: { dish: { include: { ingredients: true } } },
  });

  // Preserve checked state of existing auto items by (name|unit|dishId) key.
  const existingAuto = await prisma.shoppingListItem.findMany({
    where: { shoppingListId: list.id, source: "auto" },
  });
  const checkedMap = new Map<string, boolean>();
  for (const item of existingAuto) {
    const key = `${item.name.toLowerCase()}|${item.unit ?? ""}|${item.dishId ?? ""}`;
    if (item.checked) checkedMap.set(key, true);
  }

  type Row = {
    name: string;
    unit: string | null;
    quantity: string | null;
    category: string | null;
    dishId: string | null;
  };
  const rows: Row[] = [];

  if (mode === "dish") {
    // One row per (dish, ingredient). Group label = dish name (stored in category).
    for (const entry of entries) {
      if (!entry.dish) continue;
      for (const ing of entry.dish.ingredients) {
        rows.push({
          name: ing.name.trim(),
          unit: (ing.unit ?? "").trim() || null,
          quantity: ing.quantity ?? null,
          category: entry.dish.name,
          dishId: entry.dish.id,
        });
      }
    }
    // De-dup identical (dish, name, unit) so the same dish planned twice doesn't
    // show duplicates; sum quantities when numeric.
    const dedup = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.dishId}|${r.name.toLowerCase()}|${r.unit ?? ""}`;
      const existing = dedup.get(key);
      if (!existing) {
        dedup.set(key, { ...r });
      } else if (r.quantity) {
        if (existing.quantity == null) {
          existing.quantity = r.quantity;
        } else {
          const a = Number(existing.quantity);
          const b = Number(r.quantity);
          existing.quantity = Number.isFinite(a) && Number.isFinite(b)
            ? String(a + b)
            : `${existing.quantity} + ${r.quantity}`;
        }
      }
    }
    rows.length = 0;
    rows.push(...dedup.values());
  } else {
    // Aisle mode: aggregate by (name|unit) across all dishes.
    type Agg = Row & { dishIds: Set<string> };
    const agg = new Map<string, Agg>();
    for (const entry of entries) {
      if (!entry.dish) continue;
      for (const ing of entry.dish.ingredients) {
        const name = ing.name.trim();
        const unit = (ing.unit ?? "").trim() || null;
        const key = `${name.toLowerCase()}|${unit ?? ""}`;
        const existing = agg.get(key);
        if (!existing) {
          agg.set(key, {
            name,
            unit,
            quantity: ing.quantity ?? null,
            category: categorize(name),
            dishId: null,
            dishIds: new Set([entry.dish.id]),
          });
        } else {
          existing.dishIds.add(entry.dish.id);
          if (ing.quantity) {
            if (existing.quantity == null) {
              existing.quantity = ing.quantity;
            } else {
              const a = Number(existing.quantity);
              const b = Number(ing.quantity);
              existing.quantity = Number.isFinite(a) && Number.isFinite(b)
                ? String(a + b)
                : `${existing.quantity} + ${ing.quantity}`;
            }
          }
        }
      }
    }
    for (const a of agg.values()) {
      rows.push({
        name: a.name,
        unit: a.unit,
        quantity: a.quantity,
        category: a.category,
        dishId: a.dishIds.size === 1 ? Array.from(a.dishIds)[0] : null,
      });
    }
  }

  await prisma.$transaction([
    prisma.shoppingListItem.deleteMany({
      where: { shoppingListId: list.id, source: "auto" },
    }),
    prisma.shoppingListItem.createMany({
      data: rows.map((r, i) => {
        const key = `${r.name.toLowerCase()}|${r.unit ?? ""}|${r.dishId ?? ""}`;
        return {
          shoppingListId: list.id,
          name: r.name,
          quantity: r.quantity,
          unit: r.unit,
          category: r.category,
          source: "auto",
          dishId: r.dishId,
          checked: checkedMap.get(key) ?? false,
          checkedAt: checkedMap.get(key) ? new Date() : null,
          position: i,
        };
      }),
    }),
  ]);

  revalidatePath("/shop");
}

const addItemSchema = z.object({
  weekStart: z.string(),
  name: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
});

export async function addManualItem(input: z.infer<typeof addItemSchema>) {
  const data = addItemSchema.parse(input);
  const list = await getOrCreateList(data.weekStart);
  const max = await prisma.shoppingListItem.aggregate({
    where: { shoppingListId: list.id },
    _max: { position: true },
  });
  await prisma.shoppingListItem.create({
    data: {
      shoppingListId: list.id,
      name: data.name,
      quantity: data.quantity || null,
      unit: data.unit || null,
      category: categorize(data.name),
      source: "manual",
      position: (max._max.position ?? 0) + 1,
    },
  });
  revalidatePath("/shop");
  revalidatePath("/plan");
}

const toggleSchema = z.object({
  itemId: z.string(),
  checked: z.boolean(),
});

export async function toggleItem(input: z.infer<typeof toggleSchema>) {
  const { itemId, checked } = toggleSchema.parse(input);
  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: { checked, checkedAt: checked ? new Date() : null },
  });
  revalidatePath("/shop");
}

export async function deleteItem(itemId: string) {
  await prisma.shoppingListItem.delete({ where: { id: itemId } });
  revalidatePath("/shop");
  revalidatePath("/plan");
}

export async function clearChecked(weekStartIso: string) {
  const list = await getOrCreateList(weekStartIso);
  await prisma.shoppingListItem.deleteMany({
    where: { shoppingListId: list.id, checked: true },
  });
  revalidatePath("/shop");
}
