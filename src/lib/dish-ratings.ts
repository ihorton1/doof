import { z } from "zod";

export const DISH_RATINGS = ["dud", "eh", "yum", "delish"] as const;
export type DishRating = (typeof DISH_RATINGS)[number];
export const dishRatingSchema = z.enum(DISH_RATINGS).nullable();

export const dishRatingClasses: Record<DishRating, string> = {
  dud: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  eh: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  yum: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  delish: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

export const setDishRatingSchema = z.object({
  dishId: z.string().trim().min(1).max(200),
  rating: dishRatingSchema,
});

export type SetDishRatingAction = (
  input: z.infer<typeof setDishRatingSchema>,
) => Promise<{ rating: DishRating | null } | { error: string }>;
