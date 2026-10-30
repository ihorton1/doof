import { prisma } from "@/lib/prisma";
import { dishImagePath, getDishIdsWithImages } from "@/lib/dish-images";
import { toISODate } from "@/lib/utils";
import { readMealDays } from "@/lib/meal-days-data";
import { PlanDays } from "../plan/plan-days";
import { PlanMonth, buildMonthCells } from "../plan/plan-month";
import { setEntries } from "../plan/actions";

export const dynamic = "force-dynamic";

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "day";

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
        dishId: string | null;
        dishName: string | null;
        dishImageUrl: string | null;
        freeformText: string | null;
      }>
    >();
    for (const e of entries) {
      const iso = toISODate(e.date);
      const dayEntries = entriesByIso.get(iso) ?? [];
      dayEntries.push({
        dishId: e.dish?.id ?? null,
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
    });

    const monthLabel = monthStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const prev = new Date(year, month0 - 1, 1);
    const next = new Date(year, month0 + 1, 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    return (
      <PlanMonth
        monthLabel={monthLabel}
        monthParam={monthParam}
        prevMonth={fmt(prev)}
        nextMonth={fmt(next)}
        weeks={weeks}
      />
    );
  }

  const todayIso = toISODate(now);
  const [initialPage, dishes] = await Promise.all([
    readMealDays(todayIso),
    prisma.dish.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <PlanDays
      key={todayIso}
      initialPage={initialPage}
      monthParam={monthParam}
      dishes={dishes}
      saveMealsAction={setEntries}
    />
  );
}
