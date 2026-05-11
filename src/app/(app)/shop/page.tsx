import { prisma } from "@/lib/prisma";
import {
  getWeekStart,
  addDays,
  toISODate,
  fromISODate,
  SHOP_CATEGORIES,
} from "@/lib/utils";
import { ShopList } from "./shop-list";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = week ? fromISODate(week) : getWeekStart(new Date());
  const weekStartIso = toISODate(weekStart);
  const weekEnd = toISODate(addDays(weekStart, 6));

  const list = await prisma.shoppingList.findUnique({
    where: { weekStartDate: weekStart },
    include: {
      items: { orderBy: [{ checked: "asc" }, { position: "asc" }] },
    },
  });

  // Build category list from items, with known aisle categories ordered first
  // (per SHOP_CATEGORIES) and any other categories (e.g., dish names in
  // "by dish" mode) appended alphabetically.
  const knownOrder = SHOP_CATEGORIES as unknown as string[];
  const presentSet = new Set(
    (list?.items ?? []).map((i) => i.category ?? "other"),
  );
  const knownPresent = knownOrder.filter((c) => presentSet.has(c));
  const extraPresent = [...presentSet]
    .filter((c) => !knownOrder.includes(c))
    .sort((a, b) => a.localeCompare(b));
  const categories = [...knownPresent, ...extraPresent];

  return (
    <ShopList
      weekStart={weekStartIso}
      weekEnd={weekEnd}
      prevWeek={toISODate(addDays(weekStart, -7))}
      nextWeek={toISODate(addDays(weekStart, 7))}
      categories={categories}
      items={
        list?.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          source: i.source,
          checked: i.checked,
        })) ?? []
      }
    />
  );
}
