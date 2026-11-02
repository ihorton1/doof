"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    list.current?.focus();
    return () => { el?.close(); };
  }, []);

  function select(index: number) {
    const el = list.current;
    if (!el) return;
    const option = el.children[index];
    if (!(option instanceof HTMLElement)) return;
    setSelectedIndex(index);
    el.scrollTo({ top: option.offsetTop - (el.clientHeight - option.clientHeight) / 2, behavior: "instant" });
  }

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
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950" />
        <div
          ref={list}
          role="listbox"
          aria-label="Day to cook"
          aria-activedescendant={`planning-day-${days[selectedIndex].iso}`}
          aria-disabled={pending}
          tabIndex={0}
          onKeyDown={(event) => {
            if (pending) return;
            const offsets: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 7, PageUp: -7 };
            const offset = offsets[event.key];
            if (offset !== undefined || event.key === "Home" || event.key === "End") {
              event.preventDefault();
              select(event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : Math.max(0, Math.min(days.length - 1, selectedIndex + offset)));
            }
          }}
          onScroll={() => {
            const el = list.current;
            if (!el || pending) return;
            setSelectedIndex(Math.max(0, Math.min(days.length - 1, Math.round(el.scrollTop / 48))));
          }}
          className={cn("relative h-36 snap-y snap-mandatory overflow-y-auto overscroll-contain py-12 no-scrollbar focus-visible:outline-none focus-visible:[&_[aria-selected=true]]:underline", pending && "pointer-events-none overflow-hidden")}
        >
          {days.map((day, index) => (
            <div
              key={day.iso}
              id={`planning-day-${day.iso}`}
              role="option"
              aria-selected={selectedIndex === index}
              onClick={() => { if (!pending) select(index); }}
              className={cn("flex h-12 shrink-0 cursor-pointer snap-center items-center justify-center px-2 text-center", selectedIndex === index ? "font-bold text-emerald-800 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400")}
            >{day.label}</div>
          ))}
        </div>
      </div>
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
