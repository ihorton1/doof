"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import {
  generateShoppingList,
  addManualItem,
  toggleItem,
  toggleItems,
  deleteItem,
  clearChecked,
} from "./actions";

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  source: string;
  checked: boolean;
};

export function ShopList({
  weekStart,
  weekEnd,
  prevWeek,
  nextWeek,
  categories,
  items,
}: {
  weekStart: string;
  weekEnd: string;
  prevWeek: string;
  nextWeek: string;
  categories: string[];
  items: Item[];
}) {
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const grouped = categories.map((cat) => ({
    cat,
    items: items.filter((i) => (i.category ?? "other") === cat),
  }));
  const checkedCount = items.filter((i) => i.checked).length;

  function regenerate(mode: "aisle" | "dish") {
    startTransition(async () => {
      await generateShoppingList(weekStart, mode);
    });
  }
  function add() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await addManualItem({
        weekStart,
        name: newName.trim(),
        quantity: newQty.trim() || null,
        unit: newUnit.trim() || null,
      });
      setNewName("");
      setNewQty("");
      setNewUnit("");
      setAdding(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/shop?week=${prevWeek}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <h1 className="font-bold">Shopping list</h1>
          <div className="text-sm text-slate-500">
            {weekStart} → {weekEnd}
          </div>
        </div>
        <Link
          href={`/shop?week=${nextWeek}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">Regenerate:</span>
          <button
            type="button"
            onClick={() => regenerate("aisle")}
            disabled={isPending}
            className="h-7 px-2 rounded border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} />
            By aisle
          </button>
          <button
            type="button"
            onClick={() => regenerate("dish")}
            disabled={isPending}
            className="h-7 px-2 rounded border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} />
            By dish
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center gap-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Qty"
              className="h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 w-20"
            />
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit"
              className="h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 w-20"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Item name"
              className="h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={isPending || !newName.trim()}
            className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            Add item
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 text-sm">
          Empty. Plan some meals and tap{" "}
          <span className="font-medium">By aisle</span> or{" "}
          <span className="font-medium">By dish</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ cat, items: catItems }) =>
            catItems.length === 0 ? null : (
              <section
                key={cat}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
              >
                <SectionHeader cat={cat} items={catItems} />
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {catItems.map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      {checkedCount > 0 && (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await clearChecked(weekStart);
            })
          }
          disabled={isPending}
          className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Clear {checkedCount} checked item{checkedCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

function SectionHeader({ cat, items }: { cat: string; items: Item[] }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;
  const someChecked = checkedCount > 0 && !allChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  function toggleAll() {
    const next = !allChecked;
    startTransition(async () => {
      await toggleItems({ itemIds: items.map((i) => i.id), checked: next });
    });
  }

  return (
    <h2 className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wide text-slate-500 font-semibold">
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        disabled={isPending}
        onChange={toggleAll}
        aria-label={`Toggle all ${cat}`}
        className="size-4 accent-emerald-600 flex-shrink-0 normal-case"
      />
      <span>{cat}</span>
    </h2>
  );
}

function ItemRow({ item }: { item: Item }) {
  const [isPending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <input
        type="checkbox"
        checked={item.checked}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            await toggleItem({ itemId: item.id, checked: e.target.checked });
          })
        }
        className="size-5 accent-emerald-600 flex-shrink-0"
      />
      <div
        className={`flex-1 text-sm ${item.checked ? "line-through text-slate-400" : ""}`}
      >
        {(item.quantity || item.unit) && (
          <span className="text-slate-500 mr-2">
            {[item.quantity, item.unit].filter(Boolean).join(" ")}
          </span>
        )}
        <span>{item.name}</span>
        {item.source === "manual" && (
          <span className="text-xs text-slate-400 ml-2">(manual)</span>
        )}
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteItem(item.id);
          })
        }
        aria-label="Delete item"
        className="size-8 flex items-center justify-center text-slate-300 hover:text-rose-600"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
