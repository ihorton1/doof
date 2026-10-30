import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "./auth";
import { prisma } from "./prisma";
import { getWeekStart } from "./utils";
import { buildShoppingRows, ingredientKey } from "./shopping";

export async function requireShoppingSession() {
  if (!isValidSessionCookie((await cookies()).get(SESSION_COOKIE_NAME)?.value)) {
    throw new Error("Sign in again before updating your shopping items.");
  }
}

export async function getRollingList() {
  const active = await prisma.shoppingList.findUnique({ where: { scope: "rolling" } });
  if (active) return active;
  const weekStartDate = getWeekStart();
  const legacy = await prisma.shoppingList.findFirst({
    where: { weekStartDate: { lte: weekStartDate } },
    orderBy: { weekStartDate: "desc" },
  });
  if (legacy) {
    return prisma.shoppingList.update({ where: { id: legacy.id }, data: { scope: "rolling" } });
  }
  return prisma.shoppingList.upsert({
    where: { weekStartDate }, create: { weekStartDate, scope: "rolling" }, update: { scope: "rolling" },
  });
}

export async function getRollingBox() {
  const active = await prisma.produceBox.findUnique({ where: { scope: "rolling" } });
  if (active) return active;
  const weekStartDate = getWeekStart();
  const legacy = await prisma.produceBox.findFirst({
    where: { weekStartDate: { lte: weekStartDate } },
    orderBy: { weekStartDate: "desc" },
  });
  if (legacy) {
    return prisma.produceBox.update({ where: { id: legacy.id }, data: { scope: "rolling" } });
  }
  return prisma.produceBox.upsert({
    where: { weekStartDate }, create: { weekStartDate, scope: "rolling" }, update: { scope: "rolling" },
  });
}

export async function syncRollingShoppingList(today: Date) {
  await requireShoppingSession();
  const list = await getRollingList();
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [entries, existing] = await Promise.all([
          tx.mealPlanEntry.findMany({
            where: { date: { gte: today }, status: { in: ["planned", "cooked"] }, dishId: { not: null } },
            include: { dish: { include: { ingredients: { orderBy: { position: "asc" } } } } },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          }),
          tx.shoppingListItem.findMany({ where: { shoppingListId: list.id, source: "auto" } }),
        ]);
        const rows = buildShoppingRows(entries.flatMap(({ dish }) => dish ? [dish] : []));
        const byKey = new Map(existing.map((item) => [ingredientKey(item), item]));
        const retainedIds = new Set<string>();
        const additions: Prisma.ShoppingListItemCreateManyInput[] = [];
        for (const [position, row] of rows.entries()) {
          const previous = byKey.get(ingredientKey(row));
          if (previous) {
            retainedIds.add(previous.id);
            if (previous.name !== row.name || previous.quantity !== row.quantity ||
              previous.unit !== row.unit || previous.category !== row.category || previous.position !== position) {
              await tx.shoppingListItem.update({ where: { id: previous.id }, data: { ...row, position } });
            }
          } else {
            const aggregate = byKey.get(ingredientKey({ ...row, dishId: null }));
            additions.push({
                ...row, position, shoppingListId: list.id, source: "auto",
                checked: aggregate?.checked ?? false,
                checkedAt: aggregate?.checkedAt ?? null,
                dismissed: aggregate?.dismissed ?? false,
            });
          }
        }
        await tx.shoppingListItem.deleteMany({
          where: { id: { in: existing.filter((item) => !retainedIds.has(item.id)).map((item) => item.id) } },
        });
        if (additions.length > 0) await tx.shoppingListItem.createMany({ data: additions });
        return tx.shoppingListItem.findMany({
          where: { shoppingListId: list.id, dismissed: false },
          orderBy: [{ checked: "asc" }, { position: "asc" }],
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034") continue;
      throw error;
    }
  }
}
