import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

type MostCookedDish = {
  id: string;
  name: string;
  imageUrl: string | null;
  planCount: number;
};

export function MostCookedMeals({ dishes }: { dishes: MostCookedDish[] }) {
  return (
    <section aria-labelledby="most-cooked-heading" className="shrink-0 space-y-4 pb-4 pt-6">
      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        <UtensilsCrossed className="size-6" aria-hidden />
        <h2 id="most-cooked-heading" className="text-2xl font-extrabold tracking-tight">Most cooked</h2>
      </div>
      {dishes.length ? (
        <ol className="space-y-3">
          {dishes.map((dish) => (
            <li key={dish.id}>
              <Link
                href={`/dishes/${dish.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <div aria-hidden className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {dish.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={dish.imageUrl} alt="" width={56} height={56} loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="size-6 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <h3 className="min-w-0 flex-1 break-words font-bold text-emerald-800 dark:text-emerald-300">{dish.name}</h3>
                <span
                  aria-label={`Added to plan ${dish.planCount} ${dish.planCount === 1 ? "time" : "times"}`}
                  className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  {dish.planCount} {dish.planCount === 1 ? "time" : "times"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Add meals to your plan to see your most cooked recipes.
        </p>
      )}
    </section>
  );
}
