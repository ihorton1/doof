import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DishesPage() {
  const dishes = await prisma.dish.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { ingredients: true } },
    },
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
          {dishes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dishes/${r.id}`}
                className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="font-medium">{r.name}</div>
                {r.description && (
                  <div className="text-sm text-slate-500 line-clamp-1">
                    {r.description}
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-1">
                  {r._count.ingredients} ingredient
                  {r._count.ingredients === 1 ? "" : "s"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
