"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { DayScrollPicker } from "@/components/day-scroll-picker";
import { getReschedulingDays } from "@/lib/planning-days";
import type { RescheduleMealAction } from "./reschedule-meal";

export function ReschedulePicker({ meal, todayIso, rescheduleAction, onClose, onSaved }: {
  meal: { id: string; name: string; date: string };
  todayIso: string;
  rescheduleAction: RescheduleMealAction;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const days = getReschedulingDays(todayIso);
  const originalIndex = days.findIndex(day => day.iso === meal.date);
  const [selectedIndex, setSelectedIndex] = useState(originalIndex < 0 ? 7 : originalIndex);
  const date = days[selectedIndex].iso;
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => { el?.close(); };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="reschedule-title"
      onCancel={(event) => { if (saving.current) event.preventDefault(); else onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!saving.current) onClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xs overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="reschedule-title" className="break-words text-xl font-extrabold text-emerald-800 dark:text-emerald-300">Reschedule {meal.name}</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Close day picker" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button>
      </div>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving.current) return;
          saving.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await rescheduleAction({ entryId: meal.id, date });
              if ("error" in result) setError(result.error);
              else onSaved(date);
            } catch (cause) {
              console.error("Could not submit meal reschedule", cause);
              setError("Could not reach the server. Please try again.");
            } finally {
              saving.current = false;
            }
          });
        }}
      >
        <DayScrollPicker
          days={days}
          selectedIndex={selectedIndex}
          onSelect={(index) => { setSelectedIndex(index); setError(""); }}
          pending={pending}
          idPrefix="reschedule-day"
        />
        {originalIndex < 0 && <p className="text-sm text-slate-500 dark:text-slate-400">The current meal date ({meal.date}) is outside this range. Choose a new date.</p>}
        <p className="text-sm text-slate-500 dark:text-slate-400">Leftover time is recalculated from this date.</p>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">Cancel</button>
          <button type="submit" disabled={pending || !date} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? "Saving..." : "Save date"}</button>
        </div>
      </form>
    </dialog>
  );
}
