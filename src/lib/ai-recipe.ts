import { z } from "zod";
import type { ImportedRecipe } from "./recipe-import";

export const MAX_AI_RECIPE_LENGTH = 100_000;

export const AI_RECIPE_PROMPT = `Format the recipe we have just discussed so I can import it into Doof.

Return exactly one Schema.org Recipe JSON object, with no Markdown fences, commentary or HTML:
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Recipe title",
  "recipeIngredient": [
    "One complete ingredient line, including quantity and unit when given"
  ],
  "recipeInstructions": [
    "First cooking step.",
    "Second cooking step."
  ]
}

Use the actual recipe, not the placeholder text above.
Keep the recipe's quantities, units, temperatures, timings and instructions unchanged. Do not invent missing details or convert measurements.
Put each ingredient in its own plain-text string. Include ingredients only, not section headings.
Put each cooking step in its own plain-text string, in order. Do not add step numbers; Doof will number them.
Include only the five fields shown. Do not include image URLs, links or servings.
The name must be 1-200 characters. Include 1-200 ingredients, each at most 2,000 characters.
Include 1-200 cooking steps. Keep the numbered instructions under 20,000 characters and the complete response under 100,000 characters.
If the recipe is missing a name, ingredients or cooking instructions, ask me for the missing information rather than making it up.`;

const aiRecipeSchema = z.object({
  "@context": z.enum(["https://schema.org", "http://schema.org"]).optional(),
  "@type": z.literal("Recipe"),
  name: z.string().trim().min(1).max(200),
  recipeIngredient: z.array(z.string().trim().min(1).max(2000)).min(1).max(200),
  recipeInstructions: z.array(z.string().trim().min(1).max(20000)).min(1).max(200),
});

export class AiRecipeError extends Error {}

export function parseAiRecipe(input: string): ImportedRecipe & { notes: string } {
  if (input.length > MAX_AI_RECIPE_LENGTH) {
    throw new AiRecipeError("The response is too long. Paste at most 100,000 characters.");
  }
  const text = input.trim();
  if (!text) throw new AiRecipeError("Paste the chatbot's formatted recipe first.");
  const fenced = text.match(/^```(?:json|jsonld|application\/ld\+json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  let data: unknown;
  try {
    data = JSON.parse(fenced ? fenced[1] : text);
  } catch {
    throw new AiRecipeError("This is not valid recipe JSON. Ask the chatbot to use the copied prompt, then paste its complete response.");
  }
  const parsed = aiRecipeSchema.safeParse(data);
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    const messages: Record<string, string> = {
      "@context": "Use http://schema.org or https://schema.org for @context.",
      "@type": 'The response must have "@type": "Recipe".',
      name: "Include a recipe name between 1 and 200 characters.",
      recipeIngredient: "Include 1-200 ingredient strings, each between 1 and 2,000 characters.",
      recipeInstructions: "Include 1-200 cooking-step strings in recipeInstructions, with no empty steps.",
    };
    throw new AiRecipeError(
      messages[String(field)] ?? "Paste one Recipe JSON object using the format in the prompt.",
    );
  }
  const recipe = parsed.data;
  const notes = recipe.recipeInstructions.map((step, index) => `${index + 1}. ${step}`).join("\n\n");
  if (notes.length > 20000) {
    throw new AiRecipeError("The numbered cooking instructions exceed the 20,000-character Notes limit. Shorten them before importing.");
  }
  return { name: recipe.name, ingredients: recipe.recipeIngredient, notes };
}
