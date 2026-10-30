import { z } from "zod";

export const MAX_TAG_LENGTH = 40;

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
}

export function getTagOptions(query: string, suggestions: string[], selected: string[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const options = suggestions
    .filter(tag => !selected.includes(tag) && tag.includes(normalized))
    .slice(0, 8)
    .map(value => ({ value, create: false }));
  if (!suggestions.includes(normalized) && !selected.includes(normalized)) {
    options.push({ value: normalized, create: true });
  }
  return options;
}

export const dishTagSchema = z.object({
  dishId: z.string().min(1).max(100),
  tag: z.string().trim().min(1).max(MAX_TAG_LENGTH).transform(normalizeTag),
});

export type AddDishTagAction = (input: { dishId: string; tag: string }) => Promise<
  { status: "added" | "already-tagged"; tag: string } | { error: string }
>;
