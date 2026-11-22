"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { DayScrollPicker } from "@/components/day-scroll-picker";
import { getPlanningDays, type ChooseDishAction } from "@/lib/planning-days";

export function DayPicker({ dish, todayIso, addDishAction, onClose, onAdded }: {
  dish: { id: string; name: string };
  todayIso: string;
  addDishAction: ChooseDishAction;
  onClose: () => void;
  onAdded: (label: string, duplicate: boolean) => void;
}) {
  const days = getPlanningDays(todayIso);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => { el?.close(); };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="day-picker-title"
      onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!pending) onClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xs overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="day-picker-title" className="break-words text-xl font-extrabold text-emerald-800 dark:text-emerald-300">Plan {dish.name}</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Close day picker" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button>
      </div>
      <DayScrollPicker
        days={days}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        pending={pending}
        idPrefix="planning-day"
      />
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError("");
          const day = days[selectedIndex];
          startTransition(async () => {
            try {
              const result = await addDishAction({ dishId: dish.id, date: day.iso });
              if ("error" in result) setError(result.error);
              else onAdded(day.label, result.status === "already-planned");
            } catch (cause) {
              console.error("Could not submit meal selection", cause);
              setError("Could not reach the server. Please try again.");
            }
          });
        }}
        className="mt-4 min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >{pending ? "Adding..." : `Add to ${days[selectedIndex].label}`}</button>
    </dialog>
  );
}
