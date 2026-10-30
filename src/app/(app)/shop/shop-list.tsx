"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  addManualItem,
  toggleItems,
  deleteItems,
  clearChecked,
} from "./actions";
import { groupShoppingItems, type ShoppingItem, type DisplayShoppingItem as Item } from "@/lib/shopping";
import { useShopAction } from "./use-shop-action";

export function ShopList({ items }: { items: ShoppingItem[] }) {
  const { isPending, error, run } = useShopAction();
  const [mode, setMode] = useState<"dish" | "aisle">("dish");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const grouped = groupShoppingItems(items, mode);
  const checkedCount = items.filter((i) => i.checked).length;

  function add() {
    if (!newName.trim()) return;
    run(async () => {
      await addManualItem({
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
      <h1 className="text-center font-bold">Shopping list</h1>

      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Group shopping list" className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(["dish", "aisle"] as const).map((value) => <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`min-h-11 rounded-md px-3 text-xs font-medium ${mode === value
              ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
              : "text-slate-600 dark:text-slate-300"}`}
          >
            By {value}
          </button>)}
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="min-h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center gap-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {adding && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
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
              className="min-w-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1 basis-36"
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
          No shopping items. Ingredients from meals planned for today onward appear automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ key, cat, items: catItems }) =>
            catItems.length === 0 ? null : (
              <ShopSection key={`${mode}|${key}`} cat={cat} items={catItems} />
            ),
          )}
        </div>
      )}

      {checkedCount > 0 && (
        <button
          type="button"
          onClick={() =>
            run(async () => {
              await clearChecked();
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

function ShopSection({ cat, items }: { cat: string; items: Item[] }) {
  const allChecked = items.every((item) => item.checked);
  const [collapsed, setCollapsed] = useState(allChecked);
  const wasAllChecked = useRef(allChecked);

  useEffect(() => {
    if (allChecked !== wasAllChecked.current) {
      setCollapsed(allChecked);
      wasAllChecked.current = allChecked;
    }
  }, [allChecked]);

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <SectionHeader
        cat={cat}
        items={items}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      {!collapsed && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((item) => (
            <ItemRow key={item.ids.join("|")} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionHeader({
  cat,
  items,
  collapsed,
  onToggleCollapsed,
}: {
  cat: string;
  items: Item[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const { isPending, error, run } = useShopAction();
  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;
  const someChecked = items.some((item) => item.someChecked) && !allChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  function toggleAll() {
    const next = !allChecked;
    run(async () => {
      await toggleItems({ itemIds: items.flatMap((i) => i.ids), checked: next });
    });
  }

  return (
    <h2
      className={`flex items-center gap-3 px-3 py-2 text-xs uppercase tracking-wide text-slate-500 font-semibold ${
        collapsed ? "" : "border-b border-slate-200 dark:border-slate-800"
      }`}
    >
      {error && <span role="alert" className="normal-case text-rose-600">{error}</span>}
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        disabled={isPending}
        onChange={toggleAll}
        aria-label={`Toggle all ${cat}`}
        className="size-4 accent-emerald-600 flex-shrink-0 normal-case"
      />
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex flex-1 items-center justify-between gap-2 text-left"
        aria-expanded={!collapsed}
      >
        <span>
          {cat}
          {allChecked && (
            <span className="ml-2 normal-case font-normal">complete</span>
          )}
        </span>
        {collapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>
    </h2>
  );
}

function ItemRow({ item }: { item: Item }) {
  const { isPending, error, run } = useShopAction();
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = item.someChecked && !item.checked;
  }, [item.someChecked, item.checked]);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={item.checked}
        disabled={isPending}
        onChange={(e) =>
          run(async () => {
            await toggleItems({ itemIds: item.ids, checked: e.target.checked });
          })
        }
        className="size-5 accent-emerald-600 flex-shrink-0"
        aria-label={`Check ${item.name}`}
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
        {error && <span role="alert" className="block text-rose-600">{error}</span>}
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(async () => {
            await deleteItems({ itemIds: item.ids });
          })
        }
        aria-label={`Delete ${item.name}`}
        className="size-8 flex items-center justify-center text-slate-300 hover:text-rose-600"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
