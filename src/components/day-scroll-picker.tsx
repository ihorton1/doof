"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function DayScrollPicker({ days, selectedIndex, onSelect, pending, idPrefix }: {
  days: { iso: string; label: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  pending: boolean;
  idPrefix: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const initialIndex = useRef(selectedIndex);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = list.current;
      if (!el) return;
      el.scrollTop = initialIndex.current * 48;
      el.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function select(index: number) {
    const el = list.current;
    if (!el) return;
    const option = el.children[index];
    if (!(option instanceof HTMLElement)) return;
    onSelect(index);
    el.scrollTo({ top: option.offsetTop - (el.clientHeight - option.clientHeight) / 2, behavior: "instant" });
  }

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950" />
      <div
        ref={list}
        role="listbox"
        aria-label="Day to cook"
        aria-activedescendant={`${idPrefix}-${days[selectedIndex].iso}`}
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
          onSelect(Math.max(0, Math.min(days.length - 1, Math.round(el.scrollTop / 48))));
        }}
        className={cn("relative h-36 snap-y snap-mandatory overflow-y-auto overscroll-contain py-12 no-scrollbar focus-visible:outline-none focus-visible:[&_[aria-selected=true]]:underline", pending && "pointer-events-none overflow-hidden")}
      >
        {days.map((day, index) => (
          <div
            key={day.iso}
            id={`${idPrefix}-${day.iso}`}
            role="option"
            aria-selected={selectedIndex === index}
            onClick={() => { if (!pending) select(index); }}
            className={cn("flex h-12 shrink-0 cursor-pointer snap-center items-center justify-center px-2 text-center", selectedIndex === index ? "font-bold text-emerald-800 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400")}
          >{day.label}</div>
        ))}
      </div>
    </div>
  );
}
