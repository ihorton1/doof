"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, Plus } from "lucide-react";
import { ImagePicker } from "./image-picker";
import { TagPicker } from "./tag-picker";
import { IngredientImporter } from "./ingredient-importer";
import { DishRatingOptions } from "@/components/dish-rating-control";
import type { DishRating } from "@/lib/dish-ratings";
import type { ImportedRecipe } from "@/lib/recipe-import";

type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type Initial = {
  name?: string;
  description?: string | null;
  notes?: string | null;
  servings?: number | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  ingredients?: { name: string; quantity: string | null; unit: string | null; notes?: string | null }[];
  tags?: string[];
  rating?: DishRating | null;
};

export function DishForm({
  action,
  initial,
  suggestions,
  skipInitialUrlPreview = false,
  initialRecipe,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Initial;
  suggestions?: { names: string[]; units: string[]; tags: string[] };
  skipInitialUrlPreview?: boolean;
  initialRecipe?: ImportedRecipe;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rating, setRating] = useState<DishRating | null>(initial?.rating ?? null);
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [autoPreviewUrl, setAutoPreviewUrl] = useState(false);
  const [urlImportVersion, setUrlImportVersion] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients?.length
      ? initial.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity ?? "",
          unit: i.unit ?? "",
          notes: i.notes ?? "",
        }))
      : [{ name: "", quantity: "", unit: "", notes: "" }],
  );

  function addRow() {
    setIngredients((rows) => [...rows, { name: "", quantity: "", unit: "", notes: "" }]);
  }
  function previewUrl(value: string) {
    const url = value.trim();
    setSourceUrl(url);
    setAutoPreviewUrl(Boolean(url));
    setUrlImportVersion((version) => version + 1);
  }
  function removeRow(idx: number) {
    setIngredients((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, field: keyof Ingredient, value: string) {
    setIngredients((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  return (
    <form action={action} className="space-y-5 relative">
      <datalist id="ingredient-name-suggestions">
        {suggestions?.names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="unit-suggestions">
        {suggestions?.units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <IngredientImporter
        key={`${sourceUrl}:${urlImportVersion}`}
        sourceUrl={sourceUrl}
        autoPreview={autoPreviewUrl}
        currentImageUrl={imageUrl}
        initialRecipe={urlImportVersion === 0 && sourceUrl === initial?.sourceUrl ? initialRecipe : undefined}
        onUseImage={setImageUrl}
        onReplace={(rows, details) => {
          setIngredients(rows.map(({ name, quantity, unit, notes }) => ({ name, quantity, unit, notes: notes ?? "" })));
          if (details) {
            setName(details.name);
            if (details.notes !== undefined) setNotes(details.notes);
          }
        }}
      />

      <Field label="Name" required>
        <input
          name="name"
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="Description">
        <input
          name="description"
          maxLength={2000}
          defaultValue={initial?.description ?? ""}
          className={inputCls}
        />
      </Field>

      <Field label="Image">
        <ImagePicker value={imageUrl} onChange={setImageUrl} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Servings">
          <input
            name="servings"
            type="number"
            min={1}
            max={50}
            defaultValue={initial?.servings ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Source URL">
          <input
            name="sourceUrl"
            type="url"
            maxLength={500}
            placeholder="https://..."
            value={sourceUrl}
            onChange={(event) => {
              setSourceUrl(event.target.value);
              setAutoPreviewUrl(false);
            }}
            onPaste={(event) => {
              const url = event.clipboardData.getData("text/plain");
              if (url) {
                event.preventDefault();
                previewUrl(url);
              }
            }}
            onBlur={() => {
              if (!autoPreviewUrl && sourceUrl.trim() && (!skipInitialUrlPreview || sourceUrl.trim() !== initial?.sourceUrl)) previewUrl(sourceUrl);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                previewUrl(sourceUrl);
              }
            }}
            className={inputCls}
          />
        </Field>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Rating (optional)</legend>
        <input type="hidden" name="rating" value={rating ?? ""} />
        <DishRatingOptions rating={rating} onChange={setRating} />
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium mb-1">Tags</legend>
        <TagPicker initial={initial?.tags ?? []} suggestions={suggestions?.tags ?? []} />
      </fieldset>

      <div>
        <label className="text-sm font-medium block mb-2">Ingredients</label>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[5rem_5rem_minmax(0,1fr)_minmax(0,1fr)_3rem]">
              <input
                name="ingredient_quantity"
                value={ing.quantity}
                onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                placeholder="Qty"
                className={`${inputCls} min-w-0 col-start-1 row-start-1`}
              />
              <input
                name="ingredient_unit"
                value={ing.unit}
                onChange={(e) => updateRow(idx, "unit", e.target.value)}
                placeholder="Unit"
                list={ing.unit ? "unit-suggestions" : undefined}
                autoComplete="off"
                className={`${inputCls} min-w-0 col-start-2 row-start-1`}
              />
              <input
                name="ingredient_name"
                value={ing.name}
                onChange={(e) => updateRow(idx, "name", e.target.value)}
                placeholder="Ingredient"
                list={ing.name ? "ingredient-name-suggestions" : undefined}
                autoComplete="off"
                className={`${inputCls} min-w-0 col-start-1 row-start-2 sm:col-start-3 sm:row-start-1`}
              />
              <input
                name="ingredient_notes"
                value={ing.notes}
                onChange={(e) => updateRow(idx, "notes", e.target.value)}
                maxLength={200}
                placeholder="Note (optional)"
                aria-label={`Notes for ingredient ${idx + 1}`}
                className={`${inputCls} min-w-0 col-start-2 row-start-2 sm:col-start-4 sm:row-start-1`}
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="h-12 w-full col-start-3 row-start-2 sm:col-start-5 sm:row-start-1 flex items-center justify-center text-slate-400 hover:text-rose-600"
                aria-label="Remove ingredient"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 h-10 w-[calc(100%-3.5rem)] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex items-center justify-center gap-1"
        >
          <Plus className="size-4" /> Add ingredient
        </button>
      </div>

      <div className="space-y-2">
        <Field label="Notes">
          <textarea
            name="notes"
            rows={6}
            maxLength={20000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-describedby="dish-notes-help"
            placeholder="e.g. Make the sauce a day ahead. Use a potato ricer for a smoother texture."
            className={`${inputCls} !h-auto min-h-40 resize-y py-3 text-sm`}
          />
        </Field>
        <p id="dish-notes-help" className="text-xs text-slate-500">
          Cooking tips, substitutions, equipment, or reminders. Saved with the dish, never added to your shopping list.
        </p>
      </div>

      <div className="sticky bottom-[var(--bottom-nav-height,0px)] z-20 flex gap-3 bg-slate-50/95 py-3 backdrop-blur dark:bg-slate-950/95">
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Save dish"}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-12 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";
