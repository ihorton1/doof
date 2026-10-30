import { z } from "zod";
import { addDays, fromISODate, toISODate } from "./utils";

export const PLANNING_DAYS = 30;

export type ChooseDishAction = (input: { dishId: string; date: string }) => Promise<
  { status: "added" | "already-planned" } | { error: string }
>;

export function getPlanningDays(todayIso: string) {
  const today = fromISODate(todayIso);
  return Array.from({ length: PLANNING_DAYS }, (_, index) => {
    const date = addDays(today, index);
    return {
      iso: toISODate(date),
      label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "short",
      }),
    };
  });
}

export function isPlanningDay(iso: string, todayIso: string): boolean {
  return z.iso.date().safeParse(iso).success &&
    iso >= todayIso &&
    iso <= toISODate(addDays(fromISODate(todayIso), PLANNING_DAYS - 1));
}
