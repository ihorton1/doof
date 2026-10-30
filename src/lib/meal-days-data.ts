import { prisma } from "./prisma";
import { dishImagePath, getDishIdsWithImages } from "./dish-images";
import { buildMealDays, type MealDaysPage, type MealGrid } from "./meal-days";
import { fromISODate, toISODate } from "./utils";

export async function readMealGrid(start: Date, end: Date): Promise<MealGrid> {
  const [entries, imageIds] = await Promise.all([
    prisma.mealPlanEntry.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        mealSlot: true,
        dishId: true,
        freeformText: true,
        status: true,
        dish: {
          select: {
            id: true, name: true, updatedAt: true,
            tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
          },
        },
      },
    }),
    getDishIdsWithImages(),
  ]);
  const grid: MealGrid = {};
  for (const entry of entries) {
    const key = `${toISODate(entry.date)}|${entry.mealSlot}`;
    (grid[key] ??= []).push({
      id: entry.id,
      dishId: entry.dishId,
      dishName: entry.dish?.name ?? null,
      dishImageUrl: entry.dish && imageIds.has(entry.dish.id)
        ? dishImagePath(entry.dish.id, entry.dish.updatedAt) : null,
      dishTags: entry.dish?.tags.map(({ tag }) => tag.name) ?? [],
      freeformText: entry.freeformText,
      status: entry.status,
    });
  }
  return grid;
}

export async function readMealDays(startIso: string): Promise<MealDaysPage> {
  const range = buildMealDays(startIso);
  const grid = await readMealGrid(fromISODate(startIso), fromISODate(range.nextDate));
  return { ...range, grid };
}
