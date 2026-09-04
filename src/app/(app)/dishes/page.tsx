import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dishImagePath, getDishIdsWithImages } from "@/lib/dish-images";
import { Plus } from "lucide-react";
import { DishList, type DishListItem } from "./dish-list";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function plannedLabel(diff: number) {
  if (diff === 0) return "Planned today";
  if (diff === 1) return "Planned tomorrow";
  return `Planned in ${diff} days`;
}

function cookedLabel(diff: number) {
  if (diff === 0) return "Cooked today";
  if (diff === 1) return "Cooked yesterday";
  return `Cooked ${diff} days ago`;
}

export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag: activeTag } = await searchParams;

  const [dishes, allTags, dishIdsWithImages] = await Promise.all([
    prisma.dish.findMany({
      where: activeTag
        ? { tags: { some: { tag: { name: activeTag } } } }
        : undefined,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        ingredients: {
          select: { name: true },
          orderBy: { position: "asc" },
        },
        tags: {
          include: { tag: true },
          orderBy: { tag: { name: "asc" } },
        },
      },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        _count: { select: { dishes: true } },
      },
    }),
    getDishIdsWithImages(),
  ]);

  const today = startOfDay(new Date());
  const dishIds = dishes.map((d) => d.id);

  const [nextPlanned, lastCooked] = await Promise.all([
    prisma.mealPlanEntry.findMany({
      where: {
        dishId: { in: dishIds },
        status: "planned",
        date: { gte: today },
      },
      select: { dishId: true, date: true },
      orderBy: { date: "asc" },
    }),
    prisma.mealPlanEntry.findMany({
      where: {
        dishId: { in: dishIds },
        status: { not: "skipped" },
        date: { lte: today },
      },
      select: { dishId: true, date: true, cookedAt: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const nextByDish = new Map<string, Date>();
  for (const e of nextPlanned) {
    if (e.dishId && !nextByDish.has(e.dishId)) nextByDish.set(e.dishId, e.date);
  }
  const lastByDish = new Map<string, Date>();
  for (const e of lastCooked) {
    if (e.dishId && !lastByDish.has(e.dishId)) {
      lastByDish.set(e.dishId, e.cookedAt ?? e.date);
    }
  }

  const dishListItems: DishListItem[] = dishes.map((dish) => {
    const next = nextByDish.get(dish.id);
    const last = lastByDish.get(dish.id);
    let status: string;
    if (next) {
      status = plannedLabel(dayDiff(today, next));
    } else if (last) {
      status = cookedLabel(dayDiff(last, today));
    } else {
      status = `${dish.ingredients.length} ingredient${
        dish.ingredients.length === 1 ? "" : "s"
      }`;
    }

    return {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dishIdsWithImages.has(dish.id)
        ? dishImagePath(dish.id, dish.updatedAt)
        : null,
      tags: dish.tags.map((dishTag) => dishTag.tag.name),
      ingredientNames: dish.ingredients.map((ingredient) => ingredient.name),
      status,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dishes</h1>
        <Link
          href="/dishes/new"
          className="inline-flex items-center gap-1 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          New
        </Link>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeTag && (
            <Link
              href="/dishes"
              className="inline-flex items-center h-7 px-3 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Clear filter
            </Link>
          )}
          {allTags.map((t) => {
            const isActive = t.name === activeTag;
            return (
              <Link
                key={t.name}
                href={isActive ? "/dishes" : `/dishes?tag=${encodeURIComponent(t.name)}`}
                className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                }`}
              >
                {t.name}
                <span className="ml-1.5 opacity-70">{t._count.dishes}</span>
              </Link>
            );
          })}
        </div>
      )}

      {dishListItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
          <p className="mb-4">No dishes yet.</p>
          <Link
            href="/dishes/new"
            className="text-emerald-600 hover:underline font-medium"
          >
            Add your first one
          </Link>
        </div>
      ) : (
        <DishList dishes={dishListItems} />
      )}
    </div>
  );
}
