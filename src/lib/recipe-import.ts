import { DomUtils, parseDocument } from "htmlparser2";
import ipaddr from "ipaddr.js";

export type ImportedRecipe = {
  name: string;
  ingredients: string[];
  imageUrl?: string;
  notes?: string;
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
      let url: URL;
      try {
        url = new URL(candidate.trim(), pageUrl);
      } catch {
        continue;
      }
      const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username || url.password || url.port || url.href.length > 4000 ||
        (!ipaddr.isValid(hostname) && !hostname.includes(".")) ||
        hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
        (ipaddr.isValid(hostname) && ipaddr.parse(hostname).range() !== "unicast")
      ) {
        continue;
      }
      return url.href;
    }
  }
}

export function extractRecipes(html: string, pageUrl?: string): RecipeImportResult {
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
          if (
            !Array.isArray(lines) ||
            lines.length === 0 ||
            lines.length > 200 ||
            !lines.every((line) => typeof line === "string" && line.trim())
          ) {
            warnings.add("A recipe was skipped: it must have between 1 and 200 text ingredients.");
          } else {
            const ingredients = lines.map(plainText);
            if (ingredients.some((line) => !line || line.length > 2000)) {
              warnings.add("A recipe was skipped because an ingredient sentence is empty or longer than 2,000 characters.");
            } else {
              const name = typeof node.name === "string" ? plainText(node.name).slice(0, 200) : "";
              const imageUrl = recipeImage(node.image, pageUrl);
              if (node.image != null && !imageUrl) {
                warnings.add("A recipe image was skipped because no usable HTTP(S) image URL was found.");
              }
              const recipe: ImportedRecipe = {
                name: name || "Untitled recipe",
                ingredients,
                ...(imageUrl ? { imageUrl } : {}),
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
