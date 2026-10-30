import { filterDishes, type SearchableDish } from "./dish-search";

export function filterPlanDishes<T extends SearchableDish>(
  dishes: T[],
  tag: string | null,
  queries: string[],
): T[] {
  const tagged = tag === null ? dishes : dishes.filter(dish => dish.tags.includes(tag));
  return queries.reduce((matches, query) => filterDishes(matches, query), tagged);
}
