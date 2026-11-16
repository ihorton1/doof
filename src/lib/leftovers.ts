import { addDays, fromISODate, toISODate } from "./utils";

export const LEFTOVER_DAYS = 4;
export const LEFTOVER_RETENTION_DAYS = 10;

export type Leftover = {
  entryId: string;
  source: "plan" | "manual";
  dishId: string | null;
  name: string;
  dishImageUrl: string | null;
  plannedDate: string;
  day: number;
  daysRemaining: number;
};

export type AddLeftoversAction = (input: { name: string; cookedDate: string }) => Promise<
  { status: "added" } | { error: string }
>;

export type DismissLeftoversAction = (input: { entryId: string; source?: Leftover["source"] }) => Promise<
  { status: "dismissed" } | { error: string }
>;

type LeftoverEntry = {
  id: string;
  date: Date;
  mealSlot: string;
  status: string;
  leftoversDismissed: boolean;
  dishImageUrl: string | null;
  dish: { id: string; name: string } | null;
};

type ManualLeftoverEntry = {
  id: string;
  name: string;
  cookedDate: Date;
  dismissed: boolean;
};

export function getLeftoverWindow(todayIso: string) {
  const today = fromISODate(todayIso);
  return { gte: addDays(today, -LEFTOVER_RETENTION_DAYS), lt: today };
}

export function getManualLeftoverWindow(todayIso: string) {
  return { ...getLeftoverWindow(todayIso), lt: addDays(fromISODate(todayIso), 1) };
}

export function getLeftovers(
  entries: LeftoverEntry[],
  todayIso: string,
  manualEntries: ManualLeftoverEntry[] = [],
): Leftover[] {
  const dates = Array.from({ length: LEFTOVER_RETENTION_DAYS + 1 }, (_, index) =>
    toISODate(addDays(fromISODate(todayIso), -index)),
  );
  const planned = entries.flatMap((entry): Leftover[] => {
    const plannedDate = toISODate(entry.date);
    const day = dates.indexOf(plannedDate);
    if (day <= 0 || !entry.dish || entry.mealSlot !== "dinner" ||
      entry.status === "skipped" || entry.leftoversDismissed) return [];
    return [{
      entryId: entry.id,
      source: "plan",
      dishId: entry.dish.id,
      name: entry.dish.name,
      dishImageUrl: entry.dishImageUrl,
      plannedDate,
      day,
      daysRemaining: Math.max(0, LEFTOVER_DAYS - day + 1),
    }];
  });
  const manual = manualEntries.flatMap((entry): Leftover[] => {
    const plannedDate = toISODate(entry.cookedDate);
    const day = dates.indexOf(plannedDate);
    if (day < 0 || entry.dismissed) return [];
    return [{
      entryId: entry.id,
      source: "manual",
      dishId: null,
      name: entry.name,
      dishImageUrl: null,
      plannedDate,
      day,
      daysRemaining: Math.max(0, Math.min(LEFTOVER_DAYS, LEFTOVER_DAYS - day + 1)),
    }];
  });
  return [...planned, ...manual].sort((a, b) =>
    b.day - a.day || a.entryId.localeCompare(b.entryId) || a.source.localeCompare(b.source),
  );
}

export function isLeftoverSwipe(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) >= 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
}
