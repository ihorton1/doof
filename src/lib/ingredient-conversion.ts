export type IngredientFields = {
  name: string;
  quantity: string;
  unit: string;
};

export type IngredientDraft = IngredientFields & {
  original: string;
};

export function createIngredientDraft(original: string): IngredientDraft {
  return { original, name: "", quantity: "", unit: "" };
}

export function ingredientWords(sentence: string): { text: string; start: number; end: number }[] {
  // Separate attached measurements (200g, cup/57), but keep fractions and
  // hyphenated ingredient names selectable as a single token.
  const pattern = /\d+(?:[.,]\d+)?(?:\/\d+)?|[\p{L}\p{M}]+(?:['\u2019-][\p{L}\p{M}]+)*|[^\s]/gu;
  return Array.from(sentence.matchAll(pattern), (match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function selectedWords(sentence: string, indices: number[]): string {
  const words = ingredientWords(sentence);
  const selected = new Set(indices);
  let result = "";
  let previous = -1;
  words.forEach((word, index) => {
    if (!selected.has(index)) return;
    if (previous !== -1) {
      result += index === previous + 1 ? sentence.slice(words[previous].end, word.start) : " ";
    }
    result += word.text;
    previous = index;
  });
  return result;
}

export function ingredientDraftError(draft: IngredientDraft): string | null {
  if (!draft.name.trim()) return null;
  if (draft.name.trim().length > 200) return "Ingredient names must be 200 characters or fewer.";
  if (draft.quantity.trim().length > 50 || draft.unit.trim().length > 50) {
    return "Quantity and unit must each be 50 characters or fewer.";
  }
  return null;
}

export function convertedIngredients(drafts: IngredientDraft[]): IngredientFields[] {
  if (drafts.some((draft) => ingredientDraftError(draft))) {
    throw new Error("Finish preparing each included ingredient before replacing.");
  }
  const ingredients = drafts.filter((draft) => draft.name.trim()).map((draft) => ({
    name: draft.name.trim(),
    quantity: draft.quantity.trim(),
    unit: draft.unit.trim(),
  }));
  if (!ingredients.length) throw new Error("Include at least one ingredient.");
  return ingredients;
}
