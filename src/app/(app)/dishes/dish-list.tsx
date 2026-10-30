"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { filterDishes, getDishSearchSuggestions } from "@/lib/dish-search";

export type DishListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  ingredientNames: string[];
  status: string;
};

export function DishList({ dishes }: { dishes: DishListItem[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const searchSuggestions = useMemo(
    () => getDishSearchSuggestions(dishes),
    [dishes],
  );

  const filtered = filterDishes(dishes, normalizedQuery);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dishes, ingredients or tags..."
            aria-label="Search dishes, ingredients or tags"
            list={query ? "dish-search-suggestions" : undefined}
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          <datalist id="dish-search-suggestions">
            {searchSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      </div>

      {normalizedQuery && (
        <div className="text-xs text-slate-500">
          {filtered.length} dish{filtered.length === 1 ? "" : "es"} found
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No dishes match your search.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {filtered.map((dish) => {
            const matchingIngredients =
              normalizedQuery
                ? dish.ingredientNames.filter((name) =>
                    name.toLocaleLowerCase().includes(normalizedQuery),
                  )
                : [];

            return (
              <li key={dish.id}>
                <Link
                  href={`/dishes/${dish.id}`}
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {dish.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={dish.imageUrl}
                      alt=""
                      className="size-14 flex-shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-800"
                    />
                  ) : (
                    <div className="size-14 flex-shrink-0 rounded-md bg-slate-100 dark:bg-slate-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{dish.name}</div>
                    {dish.description && (
                      <div className="line-clamp-1 text-sm text-slate-500">
                        {dish.description}
                      </div>
                    )}
                    {matchingIngredients.length > 0 && (
                      <div className="mt-1 line-clamp-1 text-xs text-emerald-700 dark:text-emerald-400">
                        {matchingIngredients.join(", ")}
                      </div>
                    )}
                    {dish.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dish.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex h-5 items-center rounded-full bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-400">{dish.status}</div>
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
