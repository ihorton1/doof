import { prisma } from "@/lib/prisma";
import { dishImagePath, getDishIdsWithImages } from "@/lib/dish-images";
import {
  getWeekStart,
  addDays,
  toISODate,
  fromISODate,
  MEAL_SLOTS,
  type MealSlot,
} from "@/lib/utils";
import { PlanWeek, type WeekBoxItem } from "./plan-week";
import { PlanMonth, buildMonthCells } from "./plan-month";
import { MiscList } from "./misc-list";
import { TemplatesBar } from "./templates-bar";
import { ProduceBox, type BoxItem } from "./produce-box";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "week";

  // Compute "monthParam" (YYYY-MM) for toggle, default to current month
  const now = new Date();
  const monthParam =
    sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (view === "month") {
    const [yStr, mStr] = monthParam.split("-");
    const year = Number(yStr);
    const month0 = Number(mStr) - 1;
    const monthStart = new Date(year, month0, 1);
    // visible grid: 6 weeks starting on Monday on/before 1st
    const dow = monthStart.getDay();
    const offsetToMonday = (dow + 6) % 7;
    const gridStart = new Date(year, month0, 1 - offsetToMonday);
    const gridEnd = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + 42,
    );

    const [entries, dishIdsWithImages] = await Promise.all([
      prisma.mealPlanEntry.findMany({
        where: { date: { gte: gridStart, lt: gridEnd } },
        select: {
          date: true,
          freeformText: true,
          dish: { select: { id: true, name: true, updatedAt: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      getDishIdsWithImages(),
    ]);

    const entriesByIso = new Map<
      string,
      Array<{
        dishName: string | null;
        dishImageUrl: string | null;
        freeformText: string | null;
      }>
    >();
    for (const e of entries) {
      const iso = toISODate(e.date);
      const dayEntries = entriesByIso.get(iso) ?? [];
      dayEntries.push({
        dishName: e.dish?.name ?? null,
        dishImageUrl:
          e.dish && dishIdsWithImages.has(e.dish.id)
            ? dishImagePath(e.dish.id, e.dish.updatedAt)
            : null,
        freeformText: e.freeformText,
      });
      entriesByIso.set(iso, dayEntries);
    }

    const todayIso = toISODate(now);
    const weeks = buildMonthCells({
      year,
      month0,
      entriesByIso,
      todayIso,
      weekStartIsoForDate: (d) => toISODate(getWeekStart(d)),
    });

    const monthLabel = monthStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const prev = new Date(year, month0 - 1, 1);
    const next = new Date(year, month0 + 1, 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // weekParam for toggle: prefer existing ?week or week containing today
    const weekParam = sp.week ?? toISODate(getWeekStart(now));

    return (
      <PlanMonth
        monthLabel={monthLabel}
        monthParam={monthParam}
        prevMonth={fmt(prev)}
        nextMonth={fmt(next)}
        weekParam={weekParam}
        weeks={weeks}
      />
    );
  }

  const weekStart = sp.week ? fromISODate(sp.week) : getWeekStart(new Date());
  const weekStartIso = toISODate(weekStart);
  const weekEnd = addDays(weekStart, 7);

  const [plan, dishes, shoppingList, templates, produceBox, dishIdsWithImages] =
    await Promise.all([
    prisma.mealPlan.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        entries: {
          orderBy: { createdAt: "asc" },
          include: {
            dish: {
              select: {
                id: true,
                name: true,
                updatedAt: true,
                tags: {
                  include: { tag: true },
                  orderBy: { tag: { name: "asc" } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.dish.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.shoppingList.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        items: {
          where: { source: "manual" },
          orderBy: { position: "asc" },
          select: { id: true, name: true, quantity: true, unit: true },
        },
      },
    }),
    prisma.planTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { entries: true, miscItems: true } },
      },
    }),
    prisma.produceBox.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            links: {
              include: {
                mealPlanEntry: {
                  select: {
                    id: true,
                    date: true,
                    freeformText: true,
                    dish: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getDishIdsWithImages(),
  ]);

  // Build a 7-day x slots grid keyed by `${dateIso}|${slot}`
  type EntryView = {
    id: string;
    dishId: string | null;
    dishName: string | null;
    dishImageUrl: string | null;
    dishTags: string[];
    freeformText: string | null;
    status: string;
  };
  const grid: Record<string, EntryView[]> = {};
  if (plan) {
    for (const e of plan.entries) {
      const key = `${toISODate(e.date)}|${e.mealSlot}`;
      const entries = grid[key] ?? [];
      entries.push({
        id: e.id,
        dishId: e.dishId,
        dishName: e.dish?.name ?? null,
        dishImageUrl:
          e.dish && dishIdsWithImages.has(e.dish.id)
            ? dishImagePath(e.dish.id, e.dish.updatedAt)
            : null,
        dishTags: e.dish?.tags.map((dt) => dt.tag.name) ?? [],
        freeformText: e.freeformText,
        status: e.status,
      });
      grid[key] = entries;
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, iso: toISODate(d) };
  });

  const prevWeek = toISODate(addDays(weekStart, -7));
  const nextWeek = toISODate(addDays(weekStart, 7));

  const boxItems: BoxItem[] = (produceBox?.items ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    carriedFromId: i.carriedFromId,
    links: i.links.map((l) => ({
      linkId: l.id,
      entryId: l.mealPlanEntryId,
      dishName: l.mealPlanEntry.dish?.name ?? null,
      freeformText: l.mealPlanEntry.freeformText,
      dateIso: toISODate(l.mealPlanEntry.date),
    })),
  }));

  const weekEntryIds = new Set(plan?.entries.map((e) => e.id) ?? []);
  const weekBoxItems: WeekBoxItem[] = (produceBox?.items ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    linkedEntryIds: i.links
      .map((l) => l.mealPlanEntryId)
      .filter((id) => weekEntryIds.has(id)),
    totalLinks: i.links.length,
  }));

  return (
    <>
      <div className="mb-4">
        <ProduceBox weekStart={weekStartIso} items={boxItems} />
      </div>
      <PlanWeek
        weekStart={weekStartIso}
        weekEnd={toISODate(addDays(weekEnd, -1))}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        monthParam={monthParam}
        days={days.map((d) => ({ iso: d.iso, label: formatDayLabel(d.date) }))}
        slots={MEAL_SLOTS as readonly MealSlot[]}
        grid={grid}
        dishes={dishes}
        boxItems={weekBoxItems}
      />
      <div className="mt-4">
        <MiscList weekStart={weekStartIso} items={shoppingList?.items ?? []} />
      </div>
      <div className="mt-3">
        <TemplatesBar
          weekStart={weekStartIso}
          hasEntries={(plan?.entries.length ?? 0) > 0}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            entryCount: t._count.entries,
            miscCount: t._count.miscItems,
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      </div>
    </>
  );
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
