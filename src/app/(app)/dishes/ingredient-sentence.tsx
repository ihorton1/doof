"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  ingredientDraftError,
  ingredientWords,
  selectedWords,
  type IngredientDraft,
  type IngredientFields,
} from "@/lib/ingredient-conversion";

const fields: { field: keyof IngredientFields; label: string; limit: number }[] = [
  { field: "quantity", label: "Quantity", limit: 50 },
  { field: "unit", label: "Unit", limit: 50 },
  { field: "name", label: "Ingredient", limit: 200 },
];

export function IngredientSentence({
  draft,
  onChange,
  onRemove,
}: {
  draft: IngredientDraft;
  onChange: (draft: IngredientDraft) => void;
  onRemove: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const selection = selectedWords(draft.original, selected);
  const error = ingredientDraftError(draft);

  function assign(field: keyof IngredientFields) {
    onChange({ ...draft, [field]: selection });
    setSelected([]);
  }

  return (
    <div className="min-w-0">
      <fieldset
        aria-label={`Ingredient: ${draft.original}`}
        className="relative min-w-0 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 space-y-3"
      >
        <div aria-label="Original sentence: select words" className="flex select-none flex-wrap gap-1 pr-12">
          {ingredientWords(draft.original).map((word, wordIndex) => (
            <button
              key={wordIndex}
              type="button"
              aria-pressed={selected.includes(wordIndex)}
              onClick={() => setSelected((current) =>
                current.includes(wordIndex)
                  ? current.filter((value) => value !== wordIndex)
                  : [...current, wordIndex],
              )}
              className={`min-h-10 max-w-full break-all px-2 rounded-md border text-sm ${
                selected.includes(wordIndex)
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-slate-200 dark:border-slate-700 hover:border-emerald-500"
              }`}
            >
              {word.text}
            </button>
          ))}
        </div>
        <p role="status" className="text-xs text-slate-500 break-words">
          {selection ? `Selected: ${selection}` : "Select one or more words, then assign them below."}
        </p>
        <div className="flex flex-wrap gap-2">
          {fields.map(({ field, label }) => (
            <button
              key={field}
              type="button"
              disabled={!selection}
              onClick={() => assign(field)}
              className="min-h-10 px-2 rounded-lg border border-emerald-600 text-xs text-emerald-700 dark:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => setSelected([])}
            className="min-h-10 px-2 text-xs text-slate-500 disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map(({ field, label, limit }) => (
            <label key={field} className={`block text-xs font-medium ${field === "name" ? "col-span-2" : ""}`}>
              {label}{field === "name" ? " (leave blank to skip)" : " (optional)"}
              <input
                value={draft[field]}
                maxLength={limit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
                className="block w-full mt-1 h-10 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ingredient: ${draft.original}`}
          title="Remove ingredient"
          className="absolute right-2 top-2 inline-flex size-10 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </fieldset>
    </div>
  );
}
