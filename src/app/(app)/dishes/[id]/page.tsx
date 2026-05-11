import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteDish } from "../actions";
import { Pencil } from "lucide-react";
import { DeleteDishButton } from "./delete-dish-button";

export const dynamic = "force-dynamic";

export default async function DishDetailPage({
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

  const deleteAction = deleteDish.bind(null, dish.id);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dish.name}</h1>
          {dish.description && (
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {dish.description}
            </p>
          )}
          {dish.servings && (
            <p className="text-sm text-slate-500 mt-1">
              Serves {dish.servings}
            </p>
          )}
          {dish.sourceUrl && (
            <a
              href={dish.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-600 hover:underline mt-1 inline-block break-all"
            >
              Source
            </a>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Link
            href={`/dishes/${dish.id}/edit`}
            className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Edit dish"
          >
            <Pencil className="size-4" />
          </Link>
          <DeleteDishButton action={deleteAction} name={dish.name} />
        </div>
      </div>

      {dish.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={dish.imageUrl}
          alt={dish.name}
          className="w-full max-h-80 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
        />
      )}

      {dish.ingredients.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Ingredients</h2>
          <ul className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {dish.ingredients.map((ing) => (
              <li key={ing.id} className="px-4 py-2 flex gap-2 text-sm">
                {(ing.quantity || ing.unit) && (
                  <span className="text-slate-500 w-24 flex-shrink-0">
                    {[ing.quantity, ing.unit].filter(Boolean).join(" ")}
                  </span>
                )}
                <span>{ing.name}</span>
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
    </div>
  );
}
