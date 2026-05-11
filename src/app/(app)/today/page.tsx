import { prisma } from "@/lib/prisma";
import { addDays, toISODate, fromISODate } from "@/lib/utils";
import { TodayView } from "./today-view";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;

  const realToday = startOfDay(new Date());
  const realTodayIso = toISODate(realToday);

  const focus = d ? fromISODate(d) : realToday;
  const focusIso = toISODate(focus);

  const half = Math.floor(WINDOW_DAYS / 2);
  const rangeStart = addDays(focus, -half);
  const rangeEnd = addDays(focus, half + 1);

  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      mealSlot: "dinner",
      date: { gte: rangeStart, lt: rangeEnd },
    },
    include: { dish: { select: { id: true, name: true, imageUrl: true } } },
  });

  const byDate = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    byDate.set(toISODate(e.date), e);
  }

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(rangeStart, i);
    const iso = toISODate(date);
    const entry = byDate.get(iso);
    return {
      iso,
      label: formatDayLabel(date, realTodayIso),
      isToday: iso === realTodayIso,
      isFocus: iso === focusIso,
      entry: entry
        ? {
            id: entry.id,
            dishId: entry.dishId,
            dishName: entry.dish?.name ?? null,
            dishImageUrl: entry.dish?.imageUrl ?? null,
            freeformText: entry.freeformText,
            status: entry.status,
          }
        : null,
    };
  });

  return (
    <TodayView
      days={days}
      focusIso={focusIso}
      realTodayIso={realTodayIso}
      prevFocusIso={toISODate(addDays(focus, -1))}
      nextFocusIso={toISODate(addDays(focus, 1))}
    />
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayLabel(date: Date, todayIso: string): string {
  const iso = toISODate(date);
  if (iso === todayIso) return "Today";
  const today = fromISODate(todayIso);
  const diff = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
