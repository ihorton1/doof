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

  return (
    <ShopList
      weekStart={weekStartIso}
      weekEnd={weekEnd}
      prevWeek={toISODate(addDays(weekStart, -7))}
      nextWeek={toISODate(addDays(weekStart, 7))}
      categories={SHOP_CATEGORIES as unknown as string[]}
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
