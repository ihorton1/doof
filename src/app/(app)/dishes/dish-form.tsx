"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, Plus } from "lucide-react";
import { ImagePicker } from "./image-picker";
import { TagPicker } from "./tag-picker";

type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
};

type Initial = {
  name?: string;
  description?: string | null;
  notes?: string | null;
  servings?: number | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  ingredients?: { name: string; quantity: string | null; unit: string | null }[];
  tags?: string[];
};

export function DishForm({
  action,
  initial,
  suggestions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Initial;
  suggestions?: { names: string[]; units: string[]; tags: string[] };
}) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients?.length
      ? initial.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity ?? "",
          unit: i.unit ?? "",
        }))
      : [{ name: "", quantity: "", unit: "" }],
  );

  function addRow() {
    setIngredients((rows) => [...rows, { name: "", quantity: "", unit: "" }]);
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
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute -top-10 right-0 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        Cancel
      </button>
      <Field label="Name" required>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
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
        <ImagePicker initial={initial?.imageUrl ?? null} />
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
            placeholder="https://..."
            defaultValue={initial?.sourceUrl ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Tags">
        <TagPicker initial={initial?.tags ?? []} suggestions={suggestions?.tags ?? []} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Ingredients</label>
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1"
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                name="ingredient_quantity"
                value={ing.quantity}
                onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                placeholder="Qty"
                className={`${inputCls} !w-20 flex-shrink-0`}
              />
              <input
                name="ingredient_unit"
                value={ing.unit}
                onChange={(e) => updateRow(idx, "unit", e.target.value)}
                placeholder="Unit"
                list={ing.unit ? "unit-suggestions" : undefined}
                autoComplete="off"
                className={`${inputCls} !w-20 flex-shrink-0`}
              />
              <input
                name="ingredient_name"
                value={ing.name}
                onChange={(e) => updateRow(idx, "name", e.target.value)}
                placeholder="Ingredient"
                list={ing.name ? "ingredient-name-suggestions" : undefined}
                autoComplete="off"
                className={`${inputCls} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="h-12 w-12 flex items-center justify-center text-slate-400 hover:text-rose-600"
                aria-label="Remove ingredient"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={6}
          maxLength={20000}
          defaultValue={initial?.notes ?? ""}
          className={`${inputCls} font-mono text-sm`}
        />
      </Field>

      <div className="flex gap-3">
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
