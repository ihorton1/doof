export type SearchableDish = {
  name: string;
  ingredientNames: string[];
  tags: string[];
};

export function filterDishes<T extends SearchableDish>(dishes: T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  return dishes.filter(dish =>
    [dish.name, ...dish.ingredientNames, ...dish.tags].some(value =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );
}

export function getDishSearchSuggestions(dishes: SearchableDish[]): string[] {
  return [...new Set(
    dishes.flatMap(dish => [dish.name, ...dish.ingredientNames, ...dish.tags])
      .map(value => value.trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
}
