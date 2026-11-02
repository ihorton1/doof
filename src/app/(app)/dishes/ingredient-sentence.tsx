"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { ingredientSwipeOffset, isIngredientRemovalSwipe } from "@/lib/ingredient-swipe";
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
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const selection = selectedWords(draft.original, selected);
  const error = ingredientDraftError(draft);

  function assign(field: keyof IngredientFields) {
    onChange({ ...draft, [field]: selection });
    setSelected([]);
  }

  return (
    <div className="relative min-w-0 overflow-hidden rounded-lg">
      <div aria-hidden className="absolute inset-0 flex items-center justify-end gap-2 bg-rose-600 px-4 text-sm text-white">
        <Trash2 className="size-4" /> Remove
      </div>
      <fieldset
        aria-label={`Ingredient: ${draft.original}`}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y pinch-zoom" }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (!event.isPrimary || event.button !== 0 ||
            (event.target instanceof Element && event.target.closest("input, textarea, select, a, [data-no-swipe]"))) return;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            setOffset(0);
            return;
          }
          const next = ingredientSwipeOffset(dx, dy);
          if (next < 0) {
            suppressClick.current = true;
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }
          setOffset(Math.max(next, -event.currentTarget.clientWidth));
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          gesture.current = null;
          setOffset(0);
          if (start?.id === event.pointerId &&
            isIngredientRemovalSwipe(event.clientX - start.x, event.clientY - start.y)) onRemove();
        }}
        onPointerCancel={() => { gesture.current = null; setOffset(0); }}
        onDragStart={(event) => {
          if (event.target instanceof Element && !event.target.closest("input, textarea")) {
            event.preventDefault();
          }
        }}
        onLostPointerCapture={(event) => {
          if (event.target !== event.currentTarget) return;
          gesture.current = null;
          setOffset(0);
        }}
        onClickCapture={(event) => {
          if (event.detail === 0 || !suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }}
        className="relative min-w-0 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 space-y-3"
      >
        <div className="flex justify-end">
          <button
            type="button"
            data-no-swipe
            onClick={onRemove}
            aria-label={`Remove ingredient: ${draft.original}`}
            className="inline-flex min-h-10 items-center gap-1 px-2 text-xs text-rose-700 dark:text-rose-400"
          >
            <Trash2 aria-hidden className="size-4" /> Remove
          </button>
        </div>
        <div aria-label="Original sentence: select words" className="flex select-none flex-wrap gap-1">
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
      </fieldset>
    </div>
  );
}
