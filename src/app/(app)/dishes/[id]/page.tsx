import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dishImagePath, getDishIdsWithImages } from "@/lib/dish-images";
import { deleteDish } from "../actions";
import { DeleteDishButton } from "./delete-dish-button";
import { DishHeader } from "./dish-header";
import { getTagSuggestions } from "@/lib/tag-suggestions";
import { toISODate } from "@/lib/utils";
import { chooseDish } from "../../plan/choose-dish";
import { addDishTag } from "../../plan/add-dish-tag";
import { setDishRating } from "../set-dish-rating";

export const dynamic = "force-dynamic";

export default async function DishDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dish, history, dishIdsWithImages, tagSuggestions] = await Promise.all([
    prisma.dish.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        rating: true,
        description: true,
        notes: true,
        servings: true,
        sourceUrl: true,
        updatedAt: true,
        ingredients: { orderBy: { position: "asc" } },
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      },
    }),
    prisma.mealPlanEntry.findMany({
      where: {
        dishId: id,
        status: { not: "skipped" },
        date: { lte: new Date() },
      },
      orderBy: [{ date: "desc" }, { cookedAt: "desc" }],
      select: { id: true, date: true, cookedAt: true, mealSlot: true },
    }),
    getDishIdsWithImages(),
    getTagSuggestions(),
  ]);
  if (!dish) notFound();

  const deleteAction = deleteDish.bind(null, dish.id);

  return (
    <div className="space-y-4">
      <DishHeader
        key={dish.id}
        dish={{
          id: dish.id,
          name: dish.name,
          rating: dish.rating,
          description: dish.description,
          servings: dish.servings,
          sourceUrl: dish.sourceUrl,
          imageUrl: dishIdsWithImages.has(dish.id) ? dishImagePath(dish.id, dish.updatedAt) : null,
          tags: dish.tags.map(({ tag }) => tag.name),
        }}
        todayIso={toISODate(new Date())}
        tagSuggestions={tagSuggestions}
        addDishAction={chooseDish}
        addTagAction={addDishTag}
        setRatingAction={setDishRating}
      />

      {dish.ingredients.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Ingredients</h2>
          <ul className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {dish.ingredients.map((ing) => (
              <li key={ing.id} className="px-4 py-2 flex gap-2 text-sm">
                <span className="text-slate-500 w-24 flex-shrink-0 break-words">
                  {[ing.quantity, ing.unit].filter(Boolean).join(" ")}
                </span>
                <span className="min-w-0 break-words">{ing.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dish.notes && (
        <section>
          <h2 className="font-semibold mb-2">Notes</h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 whitespace-pre-wrap text-sm leading-relaxed">
            {dish.notes}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">
          Cooked {history.length > 0 && (
            <span className="text-slate-500 font-normal">
              · {history.length}{" "}
              {history.length === 1 ? "time" : "times"}
            </span>
          )}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Not cooked yet.</p>
        ) : (
          <ul className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {history.map((h) => {
              const when = h.cookedAt ?? h.date;
              return (
                <li key={h.id} className="px-4 py-2 text-sm flex justify-between gap-3">
                  <span>
                    {when.toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-slate-500 capitalize">
                    {h.mealSlot}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pt-8 flex justify-center">
        <DeleteDishButton action={deleteAction} name={dish.name} />
      </div>
    </div>
  );
}
