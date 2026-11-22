import { z } from "zod";
import { addDays, fromISODate, toISODate } from "./utils";

export const PLANNING_DAYS = 30;

export type ChooseDishAction = (input: { dishId: string; date: string }) => Promise<
  { status: "added" | "already-planned" } | { error: string }
>;

export function getPlanningDays(todayIso: string) {
  return Array.from({ length: PLANNING_DAYS }, (_, index) => pickerDay(todayIso, index));
}

export function getReschedulingDays(todayIso: string) {
  return Array.from({ length: 15 }, (_, index) => pickerDay(todayIso, index - 7));
}

function pickerDay(todayIso: string, offset: number) {
  const date = addDays(fromISODate(todayIso), offset);
  return {
    iso: toISODate(date),
    label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday" : date.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "short",
    }),
  };
}

export function isPlanningDay(iso: string, todayIso: string): boolean {
  return z.iso.date().safeParse(iso).success &&
    iso >= todayIso &&
    iso <= toISODate(addDays(fromISODate(todayIso), PLANNING_DAYS - 1));
}
