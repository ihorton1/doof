import { z } from "zod";
import { createIngredientDraft, ingredientDraftError } from "./ingredient-conversion";

const sourceUrlSchema = z.url().max(500).refine(value => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Use an HTTP or HTTPS recipe URL without credentials.");

export const peekRecipeSchema = z.object({
  name: z.string().max(200),
  ingredients: z.array(z.string().min(1).max(2000)).max(200),
  instructions: z.array(z.object({
    text: z.string().min(1).max(19000),
    section: z.string().max(19000).optional(),
  })).max(200),
});

export const recipePeekSchema = z.object({
  sourceUrl: sourceUrlSchema,
  recipes: z.array(peekRecipeSchema).min(1).max(20),
  warnings: z.array(z.string()),
});

export const recipePeekDraftSchema = z.object({
  sourceUrl: sourceUrlSchema,
  recipe: peekRecipeSchema,
});

export type PeekRecipe = z.infer<typeof peekRecipeSchema>;
export type RecipePeekDraft = z.infer<typeof recipePeekDraftSchema>;

export const PEEK_DRAFT_PREFIX = "doof:recipe-peek:";

export function recipePeekInitial(draft: RecipePeekDraft) {
  let previousSection: string | undefined;
  const notes = draft.recipe.instructions.map((step, index) => {
    const heading = step.section && step.section !== previousSection ? `${step.section}\n` : "";
    previousSection = step.section;
    return `${heading}${index + 1}. ${step.text}`;
  }).join("\n\n");
  if (notes.length > 20000) throw new Error("This method is too long to add. Open the original recipe instead.");
  const ingredients = draft.recipe.ingredients.map(line => {
    const parsed = createIngredientDraft(line);
    return { ...parsed, name: parsed.name || line };
  });
  return {
    initial: {
      name: draft.recipe.name,
      sourceUrl: draft.sourceUrl,
      notes,
      ingredients,
    },
    needsIngredientReview: ingredients.some(ingredient => ingredientDraftError(ingredient) !== null),
  };
}
