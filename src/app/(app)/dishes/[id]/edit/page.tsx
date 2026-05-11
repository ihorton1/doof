import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DishForm } from "../../dish-form";
import { updateDish } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dish = await prisma.dish.findUnique({
    where: { id },
    include: { ingredients: { orderBy: { position: "asc" } } },
  });
  if (!dish) notFound();

  const action = updateDish.bind(null, dish.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit dish</h1>
      <DishForm
        action={action}
        initial={{
          name: dish.name,
          description: dish.description,
          instructions: dish.instructions,
          servings: dish.servings,
          sourceUrl: dish.sourceUrl,
          ingredients: dish.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          })),
        }}
      />
    </div>
  );
}
