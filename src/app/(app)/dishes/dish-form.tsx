"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
};

type Initial = {
  name?: string;
  description?: string | null;
  instructions?: string | null;
  servings?: number | null;
  sourceUrl?: string | null;
  ingredients?: { name: string; quantity: string | null; unit: string | null }[];
};

export function DishForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Initial;
}) {
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
    <form action={action} className="space-y-5">
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
                className={`${inputCls} w-20 flex-shrink-0`}
              />
              <input
                name="ingredient_unit"
                value={ing.unit}
                onChange={(e) => updateRow(idx, "unit", e.target.value)}
                placeholder="Unit"
                className={`${inputCls} w-20 flex-shrink-0`}
              />
              <input
                name="ingredient_name"
                value={ing.name}
                onChange={(e) => updateRow(idx, "name", e.target.value)}
                placeholder="Ingredient"
                className={`${inputCls} flex-1`}
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

      <Field label="Instructions">
        <textarea
          name="instructions"
          rows={6}
          maxLength={20000}
          defaultValue={initial?.instructions ?? ""}
          className={`${inputCls} font-mono text-sm`}
        />
      </Field>

      <button
        type="submit"
        className="w-full h-12 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
      >
        Save dish
      </button>
    </form>
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
