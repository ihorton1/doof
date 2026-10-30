"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X, Pencil } from "lucide-react";
import { MEAL_SLOTS, type MealSlot } from "@/lib/utils";
import { fetchMealDays, type MealDaysPage, type MealEntryView as EntryView, type MealGrid, type SaveMealsAction } from "@/lib/meal-days";
import { ViewToggle } from "./view-toggle";

type Dish = { id: string; name: string };

export function PlanDays({
  initialPage,
  monthParam,
  dishes,
  saveMealsAction,
}: {
  initialPage: MealDaysPage;
  monthParam: string;
  dishes: Dish[];
  saveMealsAction: SaveMealsAction;
}) {
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(
    null,
  );
  const [pages, setPages] = useState<MealDaysPage[]>([]);
  const [savedGrid, setSavedGrid] = useState<MealGrid>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextDate = pages.at(-1)?.nextDate ?? initialPage.nextDate;
  const days = [initialPage, ...pages].flatMap((page) => page.days);
  const grid: MealGrid = Object.assign({}, initialPage.grid, ...pages.map((page) => page.grid), savedGrid);

  const loadMore = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await fetchMealDays(nextDate, controller.signal);
      if (controller.signal.aborted) return;
      if ("error" in result) setLoadError(result.error);
      else setPages((loaded) => [...loaded, result.page]);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Failed to load more meal days", error);
      setLoadError("Could not load more days. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  }, [nextDate]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || editing || isLoading || loadError ||
      typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "0px 0px 100px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [editing, isLoading, loadError, loadMore]);

  return (
    <div className="space-y-4">
      <h1 className="text-center font-bold">Meals</h1>
      <div className="flex justify-center">
        <ViewToggle current="day" monthParam={monthParam} />
      </div>

      <div className="space-y-3">
        {days.map((day) => (
          <div
            key={day.iso}
            data-meal-date={day.iso}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium text-sm">
              {day.label}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {MEAL_SLOTS.map((slot) => {
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

      <div ref={sentinelRef} className="text-center" aria-busy={isLoading}>
        {loadError && <p role="alert" className="mb-2 text-sm text-rose-600">{loadError}</p>}
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={isLoading}
          className="min-h-11 rounded-lg px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          {isLoading ? "Loading more days..." : loadError ? "Try again" : "Load next 7 days"}
        </button>
        <p role="status" className="sr-only">
          {isLoading ? "Loading the next seven days." : `${days.length} days loaded.`}
        </p>
      </div>

      {editing && (
        <EditModal
          date={editing.date}
          slot={editing.slot}
          current={grid[`${editing.date}|${editing.slot}`] ?? []}
          dishes={dishes}
          saveMealsAction={saveMealsAction}
          onSaved={(entries) => {
            const key = `${editing.date}|${editing.slot}`;
            setSavedGrid((saved) => ({ ...saved, [key]: entries }));
            setEditing(null);
          }}
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
  date,
  slot,
  current,
  dishes,
  saveMealsAction,
  onSaved,
  onClose,
}: {
  date: string;
  slot: MealSlot;
  current: EntryView[];
  dishes: Dish[];
  saveMealsAction: SaveMealsAction;
  onSaved: (entries: EntryView[]) => void;
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
  const [error, setError] = useState<string | null>(null);
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

  function save(clear = false) {
    setError(null);
    startTransition(async () => {
      try {
        const entries = await saveMealsAction({
          date,
          mealSlot: slot,
          dishIds: clear ? [] : [...dishIds],
          freeformText: clear ? null : freeformText || null,
        });
        onSaved(entries);
      } catch (error) {
        console.error("Failed to save meal dishes", error);
        setError("Could not save your dishes. Please try again.");
      }
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
      onClick={() => { if (!isPending) onClose(); }}
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
            disabled={isPending}
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
          disabled={isPending}
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
              disabled={isPending}
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
          disabled={isPending}
          onChange={(e) => setFreeformText(e.target.value)}
          placeholder="Or freeform: leftovers, takeout…"
          maxLength={500}
          className="w-full shrink-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        {error && <p role="alert" className="shrink-0 text-sm text-rose-600">{error}</p>}
        <div className="flex shrink-0 gap-2">
          {current.length > 0 && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={isPending}
              className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => save()}
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
