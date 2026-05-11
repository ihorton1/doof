import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

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

export default async function DishesPage() {
  const dishes = await prisma.dish.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      _count: { select: { ingredients: true } },
    },
  });

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

      {dishes.length === 0 ? (
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
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {dishes.map((r) => {
            const next = nextByDish.get(r.id);
            const last = lastByDish.get(r.id);
            let status: string;
            if (next) {
              status = plannedLabel(dayDiff(today, next));
            } else if (last) {
              status = cookedLabel(dayDiff(last, today));
            } else {
              status = `${r._count.ingredients} ingredient${
                r._count.ingredients === 1 ? "" : "s"
              }`;
            }
            return (
              <li key={r.id}>
                <Link
                  href={`/dishes/${r.id}`}
                  className="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {r.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="size-14 rounded-md object-cover flex-shrink-0 border border-slate-200 dark:border-slate-800"
                    />
                  ) : (
                    <div className="size-14 rounded-md bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.name}</div>
                    {r.description && (
                      <div className="text-sm text-slate-500 line-clamp-1">
                        {r.description}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">{status}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
