"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import {
  addBoxItem,
  carryOverUncoveredItems,
  deleteBoxItem,
  unlinkBoxItem,
} from "./box-actions";

export type BoxLinkedEntry = {
  linkId: string;
  entryId: string;
  dishName: string | null;
  freeformText: string | null;
  dateIso: string;
};

export type BoxItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  carriedFromId: string | null;
  links: BoxLinkedEntry[];
};

export function ProduceBox({
  weekStart,
  items,
}: {
  weekStart: string;
  items: BoxItem[];
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  const covered = items.filter((i) => i.links.length > 0).length;
  const uncovered = items.length - covered;

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addBoxItem({
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
      await deleteBoxItem(id);
    });
  }

  function unlink(itemId: string, mealPlanEntryId: string) {
    startTransition(async () => {
      await unlinkBoxItem({ itemId, mealPlanEntryId });
    });
  }

  function carryOver() {
    startTransition(async () => {
      await carryOverUncoveredItems({ weekStart });
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-baseline gap-2">
        <span className="font-medium text-sm">Produce box</span>
        <span className="text-xs text-slate-500 font-normal">
          {items.length === 0
            ? "what came in this week"
            : `${covered}/${items.length} covered`}
        </span>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-400">— nothing added yet —</li>
        )}
        {items.map((item) => {
          const covered = item.links.length > 0;
          return (
            <li key={item.id} className="px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <span
                  className={
                    covered
                      ? "mt-1 text-emerald-600 dark:text-emerald-400"
                      : "mt-1 text-slate-300 dark:text-slate-600"
                  }
                  aria-hidden
                >
                  {covered ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={covered ? "text-slate-500 dark:text-slate-400" : ""}
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

                  {item.links.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {item.links.map((l) => (
                        <li
                          key={l.linkId}
                          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs"
                        >
                          <span className="truncate max-w-[180px]">
                            {l.dishName ?? l.freeformText ?? "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => unlink(item.id, l.entryId)}
                            disabled={isPending}
                            className="size-4 inline-flex items-center justify-center rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900 disabled:opacity-50"
                            aria-label={`Unlink ${l.dishName ?? l.freeformText ?? ""}`}
                          >
                            <X className="size-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
          );
        })}
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
          placeholder="Item (e.g. kale)"
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

      {uncovered > 0 && (
        <div className="px-3 pb-3 -mt-1">
          <button
            type="button"
            onClick={carryOver}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-8 px-2 rounded text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Carry {uncovered} uncovered to next week
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
