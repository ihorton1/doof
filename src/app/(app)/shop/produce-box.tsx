"use client";

import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import {
  addBoxItem,
  resetProduceBox,
  deleteBoxItem,
  toggleBoxItem,
} from "./box-actions";
import { useShopAction } from "./use-shop-action";

export type BoxItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  carriedFromId: string | null;
  checked: boolean;
};

export function ProduceBox({
  items,
  suggestions,
}: {
  items: BoxItem[];
  suggestions: { names: string[]; units: string[] };
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const { isPending, error, run } = useShopAction();

  const checked = items.filter((item) => item.checked).length;

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    run(async () => {
      await addBoxItem({
        name: trimmed,
        quantity: quantity.trim() || null,
        unit: unit.trim() || null,
      });
      setName("");
      setQuantity("");
      setUnit("");
    });
  }

  function remove(id: string) {
    run(async () => {
      await deleteBoxItem(id);
    });
  }

  function toggle(itemId: string, nextChecked: boolean) {
    run(async () => {
      await toggleBoxItem({ itemId, checked: nextChecked });
    });
  }

  function reset() {
    if (!confirm("Empty the produce box? This removes all its items, including checked items.")) return;
    run(() => resetProduceBox());
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-baseline gap-2">
        <span className="font-medium text-sm">Produce box</span>
        {items.length > 0 && <span className="text-xs text-slate-500 font-normal">
          {checked}/{items.length} checked
        </span>}
        <button
          type="button"
          onClick={reset}
          disabled={isPending || items.length === 0}
          className="ml-auto inline-flex min-h-11 items-center gap-1 rounded px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Reset produce box"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-sm text-rose-600">{error}</p>}

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-400">— nothing added yet —</li>
        )}
        {items.map((item) => (
            <li key={item.id} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={isPending}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                  aria-label={`Check ${item.name}`}
                  className="size-5 accent-emerald-600 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={
                        item.checked ? "line-through text-slate-400" : ""
                      }
                    >
                      {item.name}
                    </span>
                    {(item.quantity || item.unit) && (
                      <span className="text-xs text-slate-500">
                        {[item.quantity, item.unit].filter(Boolean).join(" ")}
                      </span>
                    )}
                    {item.carriedFromId && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        carried over
                      </span>
                    )}
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={isPending}
                  className="size-8 inline-flex items-center justify-center rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-50 shrink-0"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-wrap gap-2 p-3 border-t border-slate-200 dark:border-slate-800"
      >
        <datalist id="produce-box-name-suggestions">
          {suggestions.names.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <datalist id="produce-box-unit-suggestions">
          {suggestions.units.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item (e.g. kale)"
          list={name ? "produce-box-name-suggestions" : undefined}
          autoComplete="off"
          className="flex-1 min-w-[140px] h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          className="w-16 h-10 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit"
          list={unit ? "produce-box-unit-suggestions" : undefined}
          autoComplete="off"
          className="w-20 h-10 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-1 h-10 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add
        </button>
      </form>

    </section>
  );
}
