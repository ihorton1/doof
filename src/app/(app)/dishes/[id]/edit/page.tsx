import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DishForm } from "../../dish-form";
import { updateDish } from "../../actions";
import { getIngredientSuggestions } from "@/lib/ingredient-suggestions";
import { getTagSuggestions } from "@/lib/tag-suggestions";

export const dynamic = "force-dynamic";

export default async function EditDishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dish, ingredient, tagSuggestions] = await Promise.all([
    prisma.dish.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
      },
    }),
    getIngredientSuggestions(),
    getTagSuggestions(),
  ]);
  if (!dish) notFound();

  const action = updateDish.bind(null, dish.id);
  const suggestions = { ...ingredient, tags: tagSuggestions };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit dish</h1>
      <DishForm
        action={action}
        suggestions={suggestions}
        initial={{
          name: dish.name,
          description: dish.description,
          notes: dish.notes,
          servings: dish.servings,
          sourceUrl: dish.sourceUrl,
          imageUrl: dish.imageUrl,
          ingredients: dish.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          })),
          tags: dish.tags.map((dt) => dt.tag.name),
        }}
      />
    </div>
  );
}
