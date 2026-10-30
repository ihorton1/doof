import { prisma } from "@/lib/prisma";
import { dishImagePath, getDishIdsWithImages } from "@/lib/dish-images";
import { toISODate } from "@/lib/utils";
import { rankPlanDishes } from "@/lib/plan-recommendations";
import { RecipeCarousel } from "./recipe-carousel";
import { chooseDish } from "./choose-dish";

export async function SavedDishes() {
  const todayIso = toISODate(new Date());
  const [dishes, images, history] = await Promise.all([
    prisma.dish.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      },
    }),
    getDishIdsWithImages(),
    prisma.mealPlanEntry.findMany({
      where: { dishId: { not: null }, status: { not: "skipped" } },
      select: { dishId: true, date: true, status: true },
    }),
  ]);
  const recommendations = rankPlanDishes(
    dishes,
    history.map(entry => ({ ...entry, date: toISODate(entry.date) })),
    todayIso,
  );

  return (
    <RecipeCarousel
      todayIso={todayIso}
      addDishAction={chooseDish}
      dishes={recommendations.map(dish => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        imageUrl: images.has(dish.id) ? dishImagePath(dish.id, dish.updatedAt) : null,
        tags: dish.tags.map(({ tag }) => tag.name),
      }))}
    />
  );
}
