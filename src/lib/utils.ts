import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Get the Monday of the week containing the given date, in local time, at 00:00.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export const MEAL_SLOTS = ["dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  dinner: "Dinner",
};

export const ENTRY_STATUSES = ["planned", "cooked", "skipped"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const SHOP_CATEGORIES = [
  "produce",
  "protein",
  "dairy",
  "pantry",
  "frozen",
  "other",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Record<ShopCategory, string[]> = {
  produce: [
    "lettuce", "tomato", "onion", "garlic", "potato", "carrot", "pepper",
    "cucumber", "spinach", "kale", "apple", "lemon", "lime", "orange",
    "banana", "berry", "berries", "herb", "parsley", "coriander", "basil",
    "mushroom", "courgette", "zucchini", "broccoli", "celery", "ginger",
    "avocado", "leek", "cabbage", "salad",
  ],
  protein: [
    "chicken", "beef", "pork", "lamb", "mince", "bacon", "sausage",
    "fish", "salmon", "tuna", "cod", "prawn", "shrimp", "tofu",
    "egg", "eggs", "lentil", "bean", "chickpea",
  ],
  dairy: [
    "milk", "butter", "cheese", "yoghurt", "yogurt", "cream",
    "parmesan", "cheddar", "feta", "mozzarella",
  ],
  pantry: [
    "flour", "sugar", "salt", "pepper", "oil", "vinegar", "rice",
    "pasta", "noodle", "bread", "stock", "broth", "sauce", "spice",
    "cumin", "paprika", "oregano", "thyme", "tin", "can", "passata",
  ],
  frozen: ["frozen", "ice cream", "peas"],
  other: [],
};

export function categorize(name: string): ShopCategory {
  const n = name.toLowerCase();
  for (const cat of SHOP_CATEGORIES) {
    if (cat === "other") continue;
    if (CATEGORY_KEYWORDS[cat].some((kw) => n.includes(kw))) return cat;
  }
  return "other";
}
