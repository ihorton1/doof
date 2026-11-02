import { filterDishes, type SearchableDish } from "./dish-search";

export type PlanFilter = { value: string; exclude: boolean };

export function filterPlanDishes<T extends SearchableDish>(
  dishes: T[],
  tags: PlanFilter[],
  queries: PlanFilter[],
): T[] {
  const tagged = dishes.filter(dish =>
    tags.every(tag => dish.tags.includes(tag.value) !== tag.exclude),
  );
  return queries.reduce((matches, query) => {
    const found = filterDishes(matches, query.value);
    if (!query.exclude) return found;
    const excluded = new Set(found);
    return matches.filter(dish => !excluded.has(dish));
  }, tagged);
}
