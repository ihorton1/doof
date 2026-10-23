"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import type { RecipeImportResult } from "@/lib/recipe-import";
import {
  convertedIngredients,
  createIngredientDraft,
  ingredientDraftError,
  type IngredientDraft,
  type IngredientFields,
} from "@/lib/ingredient-conversion";
import { IngredientSentence } from "./ingredient-sentence";
import { RecipeImagePreview } from "./recipe-image-preview";
import { AiRecipeInput } from "./ai-recipe-input";

const resultSchema = z.object({
  recipes: z.array(z.object({
    name: z.string(),
    ingredients: z.array(z.string().min(1)).min(1).max(200),
    imageUrl: z.url().optional(),
  })).min(1).max(20),
  warnings: z.array(z.string()),
});

export function IngredientImporter({
  sourceUrl,
  autoPreview,
  onReplace,
  onUseImage,
}: {
  sourceUrl: string;
  autoPreview: boolean;
  onReplace: (ingredients: IngredientFields[], details?: { name: string; notes: string }) => void;
  onUseImage: (imageUrl: string) => void;
}) {
  const [busy, setBusy] = useState(autoPreview);
  const [result, setResult] = useState<RecipeImportResult | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<IngredientDraft[][]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<"url" | "ai">("url");
  const [previewVersion, setPreviewVersion] = useState(0);

  function clearPreview() {
    setResult(null);
    setError(null);
    setMessage(null);
  }

  useEffect(() => {
    if (!autoPreview) return;
    const controller = new AbortController();
    async function preview() {
      try {
        const response = await fetch("/api/recipes/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl }),
          signal: controller.signal,
        });
        if (response.redirected || response.status === 401) {
          throw new Error("Your session has expired. Sign in again before importing.");
        }
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const failure = z.object({ error: z.string() }).safeParse(data);
          throw new Error(failure.success ? failure.data.error : "Could not import ingredients.");
        }
        const parsed = resultSchema.safeParse(data);
        if (!parsed.success) throw new Error("The import returned an invalid response. Please try again.");
        setResult(parsed.data);
        setDrafts(parsed.data.recipes.map((recipe) => recipe.ingredients.map(createIngredientDraft)));
        setSelected(0);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Could not import ingredients.");
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void preview();
    return () => controller.abort();
  }, [autoPreview, sourceUrl]);

  const recipe = result?.recipes[selected];
  const recipeDetails = previewSource === "ai" && recipe?.notes !== undefined
    ? { name: recipe.name, notes: recipe.notes }
    : undefined;
  const currentDrafts = drafts[selected] ?? [];
  const included = currentDrafts.filter((draft) => draft.name.trim());
  const ready = included.length > 0 && included.every((draft) => !ingredientDraftError(draft));
  return (
    <div className={aiOpen || busy || error || message || result
      ? "space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
      : undefined}>
      <button
        type="button"
        disabled={busy}
        aria-expanded={aiOpen}
        aria-controls="ai-recipe-input"
        onClick={() => {
          setAiOpen((open) => !open);
          clearPreview();
        }}
        className="absolute -top-12 right-0 min-h-10 px-3 rounded-lg border border-emerald-600 text-sm text-emerald-700 dark:text-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Import from AI
      </button>
      {aiOpen && (
        <AiRecipeInput
          onChange={clearPreview}
          onPreview={(recipe) => {
            setResult({ recipes: [recipe], warnings: [] });
            setDrafts([recipe.ingredients.map(createIngredientDraft)]);
            setSelected(0);
            setPreviewSource("ai");
            setPreviewVersion((version) => version + 1);
          }}
        />
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {busy ? "Fetching recipe ingredients..." : message}
      </p>
      {result && recipe && (
        <div className="space-y-3">
          {result.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
          ))}
          {result.recipes.length > 1 ? (
            <label className="block text-sm font-medium">
              Recipe to import
              <select
                value={selected}
                onChange={(event) => setSelected(Number(event.target.value))}
                className="block w-full mt-1 h-12 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {result.recipes.map((recipe, index) => (
                  <option key={index} value={index}>{recipe.name} ({recipe.ingredients.length} ingredients)</option>
                ))}
              </select>
            </label>
          ) : (
            <h3 className="font-medium">{recipe.name}</h3>
          )}
          {recipe.imageUrl ? (
            <RecipeImagePreview
              key={recipe.imageUrl}
              imageUrl={recipe.imageUrl}
              recipeName={recipe.name}
              onUse={(url) => {
                onUseImage(url);
                setMessage("Recipe image selected. Save the dish to keep it.");
              }}
            />
          ) : previewSource === "url" ? (
            <p className="text-sm text-slate-500">No image was found for this recipe.</p>
          ) : null}
          {recipeDetails && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Cooking instructions (Notes)</h4>
              <p className="text-sm whitespace-pre-wrap break-words">{recipeDetails.notes}</p>
            </div>
          )}
          <div className="space-y-3">
            {currentDrafts.map((draft, index) => (
              <IngredientSentence
                key={`${previewVersion}-${selected}-${index}`}
                draft={draft}
                index={index}
                onChange={(updated) => setDrafts((recipes) => recipes.map((rows, recipeIndex) =>
                  recipeIndex === selected
                    ? rows.map((row, rowIndex) => rowIndex === index ? updated : row)
                    : rows,
                ))}
              />
            ))}
          </div>
          {!ready && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Enter at least one ingredient name and correct any field errors before applying.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready}
              className="min-h-10 px-3 rounded-lg bg-emerald-600 text-sm text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => {
                const ingredients = convertedIngredients(currentDrafts);
                onReplace(ingredients, recipeDetails);
                setMessage(recipeDetails
                  ? `Applied recipe name, cooking instructions and ${ingredients.length} prepared ingredients. Save the dish when ready.`
                  : `Replaced ingredient rows with ${ingredients.length} prepared ingredients. Review them and save the dish when ready.`);
                setResult(null);
              }}
            >
              {recipeDetails ? "Use recipe" : "Replace ingredients"} ({included.length})
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="min-h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
            >
              Discard preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
