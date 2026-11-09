import { addDays, fromISODate, toISODate } from "./utils";

export const LEFTOVER_DAYS = 4;

export type Leftover = {
  entryId: string;
  dishId: string;
  name: string;
  dishImageUrl: string | null;
  plannedDate: string;
  day: number;
  daysRemaining: number;
};

export type DismissLeftoversAction = (input: { entryId: string }) => Promise<
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

export function getLeftoverWindow(todayIso: string) {
  const today = fromISODate(todayIso);
  return { gte: addDays(today, -LEFTOVER_DAYS), lt: today };
}

export function getLeftovers(entries: LeftoverEntry[], todayIso: string): Leftover[] {
  const dates = Array.from({ length: LEFTOVER_DAYS }, (_, index) =>
    toISODate(addDays(fromISODate(todayIso), -(index + 1))),
  );
  return entries.flatMap((entry) => {
    const plannedDate = toISODate(entry.date);
    const day = dates.indexOf(plannedDate) + 1;
    if (!day || !entry.dish || entry.mealSlot !== "dinner" ||
      entry.status === "skipped" || entry.leftoversDismissed) return [];
    return [{
      entryId: entry.id,
      dishId: entry.dish.id,
      name: entry.dish.name,
      dishImageUrl: entry.dishImageUrl,
      plannedDate,
      day,
      daysRemaining: LEFTOVER_DAYS - day + 1,
    }];
  }).sort((a, b) => b.day - a.day || a.entryId.localeCompare(b.entryId));
}

export function isLeftoverSwipe(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) >= 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
}
