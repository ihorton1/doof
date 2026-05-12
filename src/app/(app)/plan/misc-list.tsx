"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addManualItem, deleteItem } from "../shop/actions";

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
};

export function MiscList({
  weekStart,
  items,
}: {
  weekStart: string;
  items: Item[];
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addManualItem({
        weekStart,
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
    startTransition(async () => {
      await deleteItem(id);
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium text-sm">
        Misc
        <span className="ml-2 text-xs text-slate-500 font-normal">
          added to this week's shop list
        </span>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-400">— no extras —</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1">
              {item.name}
              {(item.quantity || item.unit) && (
                <span className="ml-2 text-xs text-slate-500">
                  {[item.quantity, item.unit].filter(Boolean).join(" ")}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={isPending}
              className="size-8 flex items-center justify-center rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-50"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="size-4" />
            </button>
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item"
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
