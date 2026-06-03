"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MealSlot } from "@/lib/utils";
import { upsertEntry } from "./actions";
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
  grid: Record<string, EntryView | undefined>;
  dishes: Dish[];
}) {
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/plan?week=${prevWeek}`}
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
          href={`/plan?week=${nextWeek}`}
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
                const entry = grid[`${day.iso}|${slot}`];
                return (
                  <li
                    key={slot}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    {entry?.dishImageUrl && (
                      <div className="w-12 flex-shrink-0 flex items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.dishImageUrl}
                          alt=""
                          className="size-10 rounded object-cover border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing({ date: day.iso, slot })}
                      className="flex-1 text-left min-h-9 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <EntryDisplay entry={entry} />
                    </button>
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
          current={grid[`${editing.date}|${editing.slot}`]}
          dishes={dishes}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EntryDisplay({ entry }: { entry: EntryView | undefined }) {
  if (!entry) {
    return <span className="text-slate-400">— empty —</span>;
  }
  const label = entry.dishName ?? entry.freeformText ?? "—";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={
          entry.status === "cooked"
            ? "text-emerald-700 dark:text-emerald-400"
            : entry.status === "skipped"
              ? "line-through text-slate-400"
              : ""
        }
      >
        {label}
      </span>
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
  current: EntryView | undefined;
  dishes: Dish[];
  onClose: () => void;
}) {
  const [dishId, setDishId] = useState(current?.dishId ?? "");
  const [freeformText, setFreeformText] = useState(
    current?.freeformText ?? "",
  );
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await upsertEntry({
        weekStart,
        date,
        mealSlot: slot,
        dishId: dishId || null,
        freeformText: freeformText || null,
      });
      onClose();
    });
  }

  function clear() {
    startTransition(async () => {
      await upsertEntry({
        weekStart,
        date,
        mealSlot: slot,
        dishId: null,
        freeformText: null,
      });
      onClose();
    });
  }

  const filtered = dishes.filter((r) =>
    r.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {date} · <span className="capitalize">{slot}</span>
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

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search dishes…"
          className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <div className="flex-1 overflow-y-auto -mx-4 px-4 border-y border-slate-200 dark:border-slate-800 py-2">
          <button
            type="button"
            onClick={() => setDishId("")}
            className={`w-full text-left px-3 py-2 rounded text-sm ${
              dishId === "" ? "bg-emerald-50 dark:bg-emerald-950" : ""
            }`}
          >
            <span className="text-slate-500">No dish (freeform only)</span>
          </button>
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDishId(r.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${
                dishId === r.id
                  ? "bg-emerald-50 dark:bg-emerald-950 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <input
          value={freeformText}
          onChange={(e) => setFreeformText(e.target.value)}
          placeholder="Or freeform: leftovers, takeout…"
          maxLength={500}
          className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        />

        <div className="flex gap-2">
          {current && (
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
