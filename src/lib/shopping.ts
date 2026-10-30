import { categorize, SHOP_CATEGORIES } from "./utils";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  source: string;
  dishId: string | null;
  checked: boolean;
};
export type ShoppingRow = {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  dishId: string;
};
type PlannedDish = {
  id: string;
  name: string;
  ingredients: { name: string; quantity: string | null; unit: string | null }[];
};
export type DisplayShoppingItem = Omit<ShoppingItem, "id"> & {
  ids: string[];
  someChecked: boolean;
};

export function ingredientKey(item: { name: string; unit: string | null; dishId: string | null }) {
  return JSON.stringify([item.name.trim().toLowerCase(), item.unit?.trim() || null, item.dishId]);
}

function sumQuantity(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  const a = Number(first);
  const b = Number(second);
  return Number.isFinite(a) && Number.isFinite(b) ? String(a + b) : `${first} + ${second}`;
}

export function buildShoppingRows(dishes: PlannedDish[]): ShoppingRow[] {
  const rows = new Map<string, ShoppingRow>();
  for (const dish of dishes) {
    for (const ingredient of dish.ingredients) {
      const row = {
        name: ingredient.name.trim(),
        unit: ingredient.unit?.trim() || null,
        quantity: ingredient.quantity?.trim() || null,
        category: dish.name,
        dishId: dish.id,
      };
      const key = ingredientKey(row);
      const existing = rows.get(key);
      if (existing) existing.quantity = sumQuantity(existing.quantity, row.quantity);
      else rows.set(key, row);
    }
  }
  return [...rows.values()];
}

export function groupShoppingItems(items: ShoppingItem[], mode: "dish" | "aisle") {
  const grouped = new Map<string, { cat: string; items: Map<string, DisplayShoppingItem> }>();
  for (const item of items) {
    const category = mode === "dish"
      ? item.source === "manual" ? "Extras" : item.category ?? "Other dishes"
      : categorize(item.name);
    const groupKey = mode === "aisle" ? category
      : item.source === "manual" ? "manual" : JSON.stringify(["dish", item.dishId]);
    const group = grouped.get(groupKey) ?? { cat: category, items: new Map<string, DisplayShoppingItem>() };
    const key = mode === "aisle" && item.source === "auto"
      ? ingredientKey({ ...item, dishId: null }) : item.id;
    const existing = group.items.get(key);
    if (existing) {
      existing.ids.push(item.id);
      existing.quantity = sumQuantity(existing.quantity, item.quantity);
      existing.someChecked ||= item.checked;
      existing.checked &&= item.checked;
    } else {
      group.items.set(key, { ...item, ids: [item.id], someChecked: item.checked });
    }
    grouped.set(groupKey, group);
  }
  const groups = [...grouped].map(([key, group]) => ({
    key,
    cat: group.cat,
    items: [...group.items.values()].sort((a, b) =>
      Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
  }));
  return groups.sort((a, b) => {
    if (mode === "aisle") {
      return SHOP_CATEGORIES.indexOf(categorizeCategory(a.cat)) - SHOP_CATEGORIES.indexOf(categorizeCategory(b.cat));
    }
    if (a.key === "manual" && b.key !== "manual") return 1;
    if (b.key === "manual" && a.key !== "manual") return -1;
    return a.cat.localeCompare(b.cat);
  });
}

function categorizeCategory(category: string) {
  return SHOP_CATEGORIES.find((candidate) => candidate === category) ?? "other";
}
