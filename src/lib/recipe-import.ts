import { DomUtils, parseDocument } from "htmlparser2";
import { normalizeImageUrl } from "./image-url";

export type ImportedRecipe = {
  name: string;
  ingredients: string[];
  imageUrl?: string;
  notes?: string;
  instructions?: { text: string; section?: string }[];
};

export type RecipeImportResult = {
  recipes: ImportedRecipe[];
  warnings: string[];
};

export class RecipeImportError extends Error {}

function plainText(value: string): string {
  return DomUtils.textContent(parseDocument(value))
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecipe(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some(
    (type) =>
      typeof type === "string" &&
      /^(?:Recipe|https?:\/\/schema\.org\/Recipe)$/.test(type),
  );
}

function recipeImage(value: unknown, pageUrl?: string): string | undefined {
  const pending: unknown[] = [value];
  while (pending.length) {
    const candidate = pending.pop();
    if (Array.isArray(candidate)) {
      for (let index = candidate.length - 1; index >= 0; index--) pending.push(candidate[index]);
    } else if (isRecord(candidate)) {
      pending.push(candidate.url, candidate.contentUrl);
    } else if (typeof candidate === "string" && candidate.trim()) {
      const url = normalizeImageUrl(candidate, pageUrl);
      if (url) return url;
    }
  }
}

function recipeInstructions(value: unknown, warnings: Set<string>): NonNullable<ImportedRecipe["instructions"]> {
  const steps: NonNullable<ImportedRecipe["instructions"]> = [];
  const pending: { value: unknown; section?: string }[] = [{ value }];
  let length = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (Array.isArray(item.value)) {
      for (let index = item.value.length - 1; index >= 0; index--) {
        pending.push({ value: item.value[index], section: item.section });
      }
    } else if (typeof item.value === "string") {
      const lines = item.value.replace(/<br\s*\/?>|<\/(?:p|li|div)>/gi, "\n").split(/\r?\n/);
      for (const line of lines) {
        const text = plainText(line);
        if (!text) continue;
        const headingLength = item.section && item.section !== steps.at(-1)?.section ? item.section.length + 1 : 0;
        length += text.length + headingLength + String(steps.length + 1).length + 2 + (steps.length ? 2 : 0);
        if (steps.length >= 200 || length > 19000) {
          warnings.add("The method was omitted because it exceeds 200 steps or 19,000 characters. Read it on the original site.");
          return [];
        }
        steps.push({ text, ...(item.section ? { section: item.section } : {}) });
      }
    } else if (isRecord(item.value)) {
      const node = item.value;
      if (node.itemListElement !== undefined) {
        const section = typeof node.name === "string" ? plainText(node.name) : item.section;
        pending.push({ value: node.itemListElement, section });
      } else if (typeof node.text === "string") {
        pending.push({ value: node.text, section: item.section });
      } else {
        warnings.add("Some method details could not be read. Check the original site for the complete method.");
      }
    } else if (item.value != null) {
      warnings.add("Some method details could not be read. Check the original site for the complete method.");
    }
  }
  return steps;
}

export function extractRecipes(html: string, pageUrl?: string, options: { preview?: boolean } = {}): RecipeImportResult {
  const document = parseDocument(html);
  const scripts = DomUtils.getElementsByTagName("script", document.children);
  const recipes: ImportedRecipe[] = [];
  const warnings = new Set<string>();
  const seen = new Set<string>();
  let foundJsonLd = false;
  let foundRecipe = false;

  for (const script of scripts) {
    if (script.attribs.type?.trim().toLowerCase() !== "application/ld+json") {
      continue;
    }
    foundJsonLd = true;
    let data: unknown;
    try {
      data = JSON.parse(DomUtils.textContent(script));
    } catch {
      warnings.add("Some JSON-LD metadata could not be read because it contains invalid JSON.");
      continue;
    }

    const pending: unknown[] = [data];
    while (pending.length) {
      const node = pending.pop();
      if (Array.isArray(node)) {
        for (let index = node.length - 1; index >= 0; index--) pending.push(node[index]);
      } else if (isRecord(node)) {
        if (isRecipe(node["@type"])) {
          foundRecipe = true;
          const lines = typeof node.recipeIngredient === "string"
            ? [node.recipeIngredient]
            : node.recipeIngredient;
          let ingredients: string[] = [];
          if (
            !Array.isArray(lines) ||
            lines.length === 0 ||
            lines.length > 200 ||
            !lines.every((line) => typeof line === "string" && line.trim())
          ) {
            warnings.add(options.preview
              ? "Ingredients could not be read for a recipe: it must have between 1 and 200 text ingredients."
              : "A recipe was skipped: it must have between 1 and 200 text ingredients.");
          } else {
            ingredients = lines.map(plainText);
            if (ingredients.some((line) => !line || line.length > 2000)) {
              warnings.add(options.preview
                ? "Ingredients were omitted for a recipe because a sentence is empty or longer than 2,000 characters."
                : "A recipe was skipped because an ingredient sentence is empty or longer than 2,000 characters.");
              ingredients = [];
            }
          }
          if (ingredients.length || options.preview) {
              const name = typeof node.name === "string" ? plainText(node.name).slice(0, 200) : "";
              const imageUrl = recipeImage(node.image, pageUrl);
              if (node.image != null && !imageUrl) {
                warnings.add("A recipe image was skipped because no usable HTTP(S) image URL was found.");
              }
              const recipe: ImportedRecipe = {
                name,
                ingredients,
                ...(imageUrl ? { imageUrl } : {}),
                ...(options.preview ? { instructions: recipeInstructions(node.recipeInstructions, warnings) } : {}),
              };
              const key = JSON.stringify(recipe);
              if (!seen.has(key)) {
                if (recipes.length >= 20) {
                  throw new RecipeImportError("This page contains too many recipes. Use a URL for a single recipe.");
                }
                seen.add(key);
                recipes.push(recipe);
            }
          }
        }
        const values = Object.values(node);
        for (let index = values.length - 1; index >= 0; index--) pending.push(values[index]);
      }
    }
  }

  if (!recipes.length) {
    const reason = !foundJsonLd
      ? "No Schema.org JSON-LD metadata was found on this page."
      : foundRecipe
        ? "No usable recipe ingredients were found in this page's JSON-LD metadata."
        : "No Schema.org Recipe was found in this page's JSON-LD metadata.";
    throw new RecipeImportError([reason, ...warnings].join(" "));
  }
  return { recipes, warnings: [...warnings] };
}
