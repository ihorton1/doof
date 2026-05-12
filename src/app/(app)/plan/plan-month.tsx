import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ViewToggle } from "./view-toggle";
import { toISODate } from "@/lib/utils";

type Cell = {
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  weekStartIso: string;
  dishName: string | null;
  dishImageUrl: string | null;
  freeformText: string | null;
};

export function PlanMonth({
  monthLabel,
  monthParam,
  prevMonth,
  nextMonth,
  weekParam,
  weeks,
}: {
  monthLabel: string;
  monthParam: string;
  prevMonth: string;
  nextMonth: string;
  weekParam: string;
  weeks: Cell[][];
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/plan?view=month&month=${prevMonth}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <h1 className="font-bold">{monthLabel}</h1>
        </div>
        <Link
          href={`/plan?view=month&month=${nextMonth}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="flex justify-center">
        <ViewToggle current="month" weekParam={weekParam} monthParam={monthParam} />
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-slate-500">
        {dayNames.map((n) => (
          <div key={n} className="py-1">
            {n}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
        {weeks.flat().map((cell) => {
          const label = cell.dishName ?? cell.freeformText;
          return (
            <Link
              key={cell.iso}
              href={`/plan?view=week&week=${cell.weekStartIso}`}
              className={`relative min-h-[68px] sm:min-h-[88px] p-1 flex flex-col items-stretch text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                cell.inMonth ? "" : "opacity-40"
              }`}
            >
              <div
                className={`text-[10px] leading-none font-medium ${
                  cell.isToday
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500"
                }`}
              >
                {cell.dayNum}
              </div>
              {cell.dishImageUrl ? (
                <div className="mt-1 flex-1 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cell.dishImageUrl}
                    alt={cell.dishName ?? ""}
                    className="w-full h-full max-h-12 sm:max-h-16 object-cover rounded"
                  />
                </div>
              ) : label ? (
                <div className="mt-1 text-[10px] sm:text-xs leading-tight line-clamp-3 text-slate-700 dark:text-slate-300">
                  {label}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function buildMonthCells(opts: {
  year: number;
  month0: number; // 0-11
  entriesByIso: Map<
    string,
    { dishName: string | null; dishImageUrl: string | null; freeformText: string | null }
  >;
  todayIso: string;
  weekStartIsoForDate: (d: Date) => string;
}): Cell[][] {
  const { year, month0, entriesByIso, todayIso, weekStartIsoForDate } = opts;
  const firstOfMonth = new Date(year, month0, 1);
  // Week starts Monday (matches getWeekStart)
  const dow = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const offsetToMonday = (dow + 6) % 7;
  const gridStart = new Date(year, month0, 1 - offsetToMonday);

  const weeks: Cell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + w * 7 + d,
      );
      const iso = toISODate(date);
      const entry = entriesByIso.get(iso);
      row.push({
        iso,
        dayNum: date.getDate(),
        inMonth: date.getMonth() === month0,
        isToday: iso === todayIso,
        weekStartIso: weekStartIsoForDate(date),
        dishName: entry?.dishName ?? null,
        dishImageUrl: entry?.dishImageUrl ?? null,
        freeformText: entry?.freeformText ?? null,
      });
    }
    weeks.push(row);
  }
  return weeks;
}
