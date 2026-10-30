"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Pencil } from "lucide-react";
import type { MealSlot } from "@/lib/utils";
import { setEntries } from "./actions";
import { ViewToggle } from "./view-toggle";

type EntryView = {
  id: string;
  dishId: string | null;
  dishName: string | null;
  dishImageUrl: string | null;
  dishTags: string[];
  freeformText: string | null;
  status: string;
};

type Dish = { id: string; name: string };

export function PlanWeek({
  weekStart,
  weekEnd,
  prevWeek,
  nextWeek,
  monthParam,
  days,
  slots,
  grid,
  dishes,
}: {
  weekStart: string;
  weekEnd: string;
  prevWeek: string;
  nextWeek: string;
  monthParam: string;
  days: { iso: string; label: string }[];
  slots: readonly MealSlot[];
  grid: Record<string, EntryView[]>;
  dishes: Dish[];
}) {
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(
    null,
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/meals?week=${prevWeek}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <h1 className="font-bold">Week of</h1>
          <div className="text-sm text-slate-500">
            {weekStart} → {weekEnd}
          </div>
        </div>
        <Link
          href={`/meals?week=${nextWeek}`}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="flex justify-center">
        <ViewToggle current="week" weekParam={weekStart} monthParam={monthParam} />
      </div>

      <div className="space-y-3">
        {days.map((day) => (
          <div
            key={day.iso}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium text-sm">
              {day.label}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {slots.map((slot) => {
                const entries = grid[`${day.iso}|${slot}`] ?? [];
                return (
                  <li key={slot} className="px-3 py-2 text-sm">
                    {entries.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setEditing({ date: day.iso, slot })}
                        className="w-full text-left min-h-9 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                      >
                        — empty —
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {entries.map((entry) => {
                          return (
                            <div key={entry.id} className="flex items-center gap-2">
                              {entry.dishImageUrl && (
                                <div className="w-12 flex-shrink-0 flex items-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={entry.dishImageUrl}
                                    alt=""
                                    className="size-10 rounded object-cover border border-slate-200 dark:border-slate-700"
                                  />
                                </div>
                              )}
                              <EntryBody entry={entry} />
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setEditing({ date: day.iso, slot })}
                          className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="size-4" />
                          Edit dishes
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <EditModal
          weekStart={weekStart}
          date={editing.date}
          slot={editing.slot}
          current={grid[`${editing.date}|${editing.slot}`] ?? []}
          dishes={dishes}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EntryBody({
  entry,
}: {
  entry: EntryView;
}) {
  const label = entry.dishName ?? entry.freeformText ?? "—";
  const className =
    entry.status === "cooked"
      ? "text-emerald-700 dark:text-emerald-400"
      : entry.status === "skipped"
        ? "line-through text-slate-400"
        : "";

  const content = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={className}>{label}</span>
      {entry.dishTags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center h-4 px-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-medium"
        >
          {t}
        </span>
      ))}
    </span>
  );

  if (entry.dishId) {
    return (
      <Link
        href={`/dishes/${entry.dishId}`}
        className="flex-1 min-h-9 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex-1 min-h-9 px-2 py-1 flex items-center">{content}</div>;
}

function EditModal({
  weekStart,
  date,
  slot,
  current,
  dishes,
  onClose,
}: {
  weekStart: string;
  date: string;
  slot: MealSlot;
  current: EntryView[];
  dishes: Dish[];
  onClose: () => void;
}) {
  const [dishIds, setDishIds] = useState(
    () => new Set(current.flatMap((entry) => (entry.dishId ? [entry.dishId] : []))),
  );
  const [freeformText, setFreeformText] = useState(
    current.find((entry) => entry.freeformText)?.freeformText ?? "",
  );
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const viewport = window.visualViewport;
    function updateViewport() {
      if (!overlay) return;
      // Mobile keyboards can resize and pan the visual viewport without resizing the layout.
      overlay.style.top = `${viewport?.offsetTop ?? 0}px`;
      overlay.style.height = `${viewport?.height ?? window.innerHeight}px`;
    }
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  function save() {
    startTransition(async () => {
      await setEntries({
        weekStart,
        date,
        mealSlot: slot,
        dishIds: [...dishIds],
        freeformText: freeformText || null,
      });
      onClose();
    });
  }

  function clear() {
    startTransition(async () => {
      await setEntries({
        weekStart,
        date,
        mealSlot: slot,
        dishIds: [],
        freeformText: null,
      });
      onClose();
    });
  }

  const filtered = dishes.filter((r) =>
    r.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const selectedDishes = dishes.filter((dish) => dishIds.has(dish.id));

  return (
    <div
      ref={overlayRef}
      className="fixed inset-x-0 top-0 h-dvh z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-dishes-title"
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 gap-3 h-[85%] max-h-[40rem] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 id="plan-dishes-title" className="font-semibold">
            {date}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {selectedDishes.length > 0 && (
          <ul aria-label="Selected dishes" className="flex max-h-32 shrink-0 flex-wrap gap-2 overflow-y-auto overscroll-contain">
            {selectedDishes.map((dish) => (
              <li key={dish.id} className="min-w-0 max-w-full">
                <button
                  type="button"
                  aria-label={`Remove ${dish.name}`}
                  disabled={isPending}
                  onClick={() => setDishIds((selected) => {
                    const next = new Set(selected);
                    next.delete(dish.id);
                    return next;
                  })}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50 dark:bg-emerald-900 dark:text-emerald-200"
                >
                  <span className="min-w-0 break-words">{dish.name}</span>
                  <X aria-hidden className="size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search dishes…"
          aria-label="Search dishes"
          className="w-full shrink-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <div className="flex-1 min-h-16 overflow-y-auto overscroll-contain -mx-4 px-4 border-y border-slate-200 dark:border-slate-800 py-2">
          {filtered.length === 0 && (
            <p role="status" className="px-3 py-2 text-sm text-slate-500">No dishes found.</p>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={dishIds.has(r.id)}
              onClick={() =>
                setDishIds((selected) => {
                  const next = new Set(selected);
                  if (next.has(r.id)) next.delete(r.id);
                  else next.add(r.id);
                  return next;
                })
              }
              className={`w-full text-left px-3 py-2 rounded text-sm ${
                dishIds.has(r.id)
                  ? "bg-emerald-50 dark:bg-emerald-950 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className={`size-4 rounded border flex items-center justify-center ${
                    dishIds.has(r.id)
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {dishIds.has(r.id) && "✓"}
                </span>
                {r.name}
              </span>
            </button>
          ))}
        </div>

        <input
          value={freeformText}
          onChange={(e) => setFreeformText(e.target.value)}
          placeholder="Or freeform: leftovers, takeout…"
          maxLength={500}
          className="w-full shrink-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <div className="flex shrink-0 gap-2">
          {current.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={isPending}
              className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="flex-1 h-11 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
