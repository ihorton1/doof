import { prisma } from "@/lib/prisma";
import {
  getWeekStart,
  addDays,
  toISODate,
  fromISODate,
  MEAL_SLOTS,
  type MealSlot,
} from "@/lib/utils";
import { PlanWeek } from "./plan-week";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = week ? fromISODate(week) : getWeekStart(new Date());
  const weekStartIso = toISODate(weekStart);
  const weekEnd = addDays(weekStart, 7);

  const [plan, dishes] = await Promise.all([
    prisma.mealPlan.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        entries: {
          include: { dish: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.dish.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Build a 7-day x slots grid keyed by `${dateIso}|${slot}`
  type EntryView = {
    id: string;
    dishId: string | null;
    dishName: string | null;
    freeformText: string | null;
    status: string;
  };
  const grid: Record<string, EntryView | undefined> = {};
  if (plan) {
    for (const e of plan.entries) {
      const key = `${toISODate(e.date)}|${e.mealSlot}`;
      grid[key] = {
        id: e.id,
        dishId: e.dishId,
        dishName: e.dish?.name ?? null,
        freeformText: e.freeformText,
        status: e.status,
      };
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, iso: toISODate(d) };
  });

  const prevWeek = toISODate(addDays(weekStart, -7));
  const nextWeek = toISODate(addDays(weekStart, 7));

  return (
    <PlanWeek
      weekStart={weekStartIso}
      weekEnd={toISODate(addDays(weekEnd, -1))}
      prevWeek={prevWeek}
      nextWeek={nextWeek}
      days={days.map((d) => ({ iso: d.iso, label: formatDayLabel(d.date) }))}
      slots={MEAL_SLOTS as readonly MealSlot[]}
      grid={grid}
      dishes={dishes}
    />
  );
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
