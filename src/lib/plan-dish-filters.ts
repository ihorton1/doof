import { filterDishes, type SearchableDish } from "./dish-search";

export type PlanFilter = { value: string; exclude: boolean };

export function getPopularPlanTags(dishes: Pick<SearchableDish, "tags">[]): string[] {
  const counts = new Map<string, number>();
  for (const dish of dishes) {
    for (const tag of new Set(dish.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
    .slice(0, 10)
    .map(([tag]) => tag);
}

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
