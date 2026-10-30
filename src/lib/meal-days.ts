import { z } from "zod";
import { addDays, fromISODate, toISODate, type MealSlot } from "./utils";

export const MEAL_DAYS_PAGE_SIZE = 7;
export const mealDateSchema = z.iso.date();

const entrySchema = z.object({
  id: z.string(),
  dishId: z.string().nullable(),
  dishName: z.string().nullable(),
  dishImageUrl: z.string().nullable(),
  dishTags: z.array(z.string()),
  freeformText: z.string().nullable(),
  status: z.string(),
});

export const mealDaysPageSchema = z.object({
  days: z.array(z.object({ iso: mealDateSchema, label: z.string() })).length(MEAL_DAYS_PAGE_SIZE),
  grid: z.record(z.string(), z.array(entrySchema)),
  nextDate: mealDateSchema,
});

export type MealEntryView = z.infer<typeof entrySchema>;
export type MealGrid = Record<string, MealEntryView[]>;
export type MealDaysPage = z.infer<typeof mealDaysPageSchema>;
export type SaveMealsInput = {
  date: string;
  mealSlot: MealSlot;
  dishIds: string[];
  freeformText?: string | null;
};
export type SaveMealsAction = (input: SaveMealsInput) => Promise<MealEntryView[]>;

export function buildMealDays(startIso: string) {
  const start = fromISODate(mealDateSchema.parse(startIso));
  const days = Array.from({ length: MEAL_DAYS_PAGE_SIZE }, (_, index) => {
    const date = addDays(start, index);
    return {
      iso: toISODate(date),
      label: date.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric",
      }),
    };
  });
  return { days, nextDate: toISODate(addDays(start, MEAL_DAYS_PAGE_SIZE)) };
}

export async function fetchMealDays(startIso: string, signal: AbortSignal): Promise<
  { page: MealDaysPage } | { error: string }
> {
  const response = await fetch(`/api/meals?start=${encodeURIComponent(startIso)}`, {
    cache: "no-store",
    signal,
  });
  if (response.redirected || response.status === 401) {
    return { error: "Your session expired. Sign in again to load more days." };
  }
  if (!response.ok) return { error: "Could not load more days. Please try again." };
  const page = mealDaysPageSchema.parse(await response.json());
  const expected = buildMealDays(startIso);
  if (page.nextDate !== expected.nextDate ||
    page.days.some((day, index) => day.iso !== expected.days[index].iso)) {
    throw new Error("The meals response contained an unexpected date range.");
  }
  return { page };
}
