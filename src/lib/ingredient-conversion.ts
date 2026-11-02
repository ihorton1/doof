import { isKnownIngredientUnit } from "./ingredient-unit";

export type IngredientFields = {
  name: string;
  quantity: string;
  unit: string;
};

export type IngredientDraft = IngredientFields & {
  original: string;
  dismissed?: boolean;
};

const fraction = String.raw`[\u00bc-\u00be\u2150-\u215e]`;
const amount = String.raw`(?:\d+\s+\d+\s*[/\u2044]\s*\d+|\d+\s*${fraction}|\d+\s*[/\u2044]\s*\d+|\d+(?:[.,]\d+)?|[.,]\d+|${fraction})`;
const quantityPrefix = new RegExp(String.raw`^(${amount}(?:\s*(?:[-\u2013\u2014]|to)\s*${amount})?)(?=\s|\p{L}|$)(.*)$`, "iu");
const extraUnits = new Set([
  "can", "cans", "bunch", "bunches", "pinch", "pinches", "handful", "handfuls",
  "sprig", "sprigs", "stalk", "stalks", "stick", "sticks", "head", "heads",
  "slice", "slices", "pint", "pints", "quart", "quarts", "gallon", "gallons",
  "pack", "packs", "packet", "packets", "piece", "pieces", "drop", "drops",
  "dash", "dashes", "fl oz", "fluid ounce", "fluid ounces",
]);

export function createIngredientDraft(original: string): IngredientDraft {
  const text = original.trim().replace(/^[-*\u2022]\s+/, "");
  const fallback = { original, name: text, quantity: "", unit: "" };
  if (/^(?:for\s+(?:the\s+)?[^,.;]+:?|[^.!?]+:)$/i.test(text)) {
    return { ...fallback, name: "" };
  }
  const match = quantityPrefix.exec(text);
  if (!match) return fallback;
  const quantity = match[1].trim();
  let name = match[2].trim();
  if (!name || /^(?:[(/]|\d|[x\u00d7](?:\s|\d))/i.test(name)) return fallback;

  const measurement = /^(?:(heaped|heaping|level|rounded|scant)\s+)?(fl\.?\s+oz\.?|fluid\s+ounces?|[\p{L}]+\.?)(?=\s|[/(]|$)\s*/iu.exec(name);
  const candidate = measurement?.[2].toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  const knownUnit = candidate && (isKnownIngredientUnit(candidate) || extraUnits.has(candidate));
  if (!knownUnit || !measurement) {
    return /^\s/.test(match[2]) ? { ...fallback, quantity, name } : fallback;
  }
  const unit = measurement[0].trim();
  name = name.slice(measurement[0].length).replace(/^of\s+/i, "").trim();
  // Keep package sizes and alternative measurements intact rather than dropping them.
  if (!name || /^[(/]/.test(name)) return fallback;
  return { original, quantity, unit, name };
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
  if (draft.dismissed || !draft.name.trim()) return null;
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
  const ingredients = drafts.filter((draft) => !draft.dismissed && draft.name.trim()).map((draft) => ({
    name: draft.name.trim(),
    quantity: draft.quantity.trim(),
    unit: draft.unit.trim(),
  }));
  if (!ingredients.length) throw new Error("Include at least one ingredient.");
  return ingredients;
}
