"use client";

import { useEffect, useId, useRef } from "react";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createFilterClicks } from "@/lib/filter-clicks";

export function FilterBubble({ value, active, excluded, removable = false, resetVersion, onActivate, onExclude }: {
  value: string;
  active: boolean;
  excluded: boolean;
  removable?: boolean;
  resetVersion: number;
  onActivate: () => void;
  onExclude: () => void;
}) {
  const actions = useRef({ onActivate, onExclude });
  const clicks = useRef<ReturnType<typeof createFilterClicks> | null>(null);
  const modeDescriptionId = useId();
  useEffect(() => { actions.current = { onActivate, onExclude }; }, [onActivate, onExclude]);
  useEffect(() => () => { clicks.current?.cancel(); }, [resetVersion]);

  return (
    <button
      type="button"
      aria-label={removable ? `Remove ${excluded ? "excluded " : ""}filter ${value}` : value}
      aria-pressed={removable ? undefined : active}
      aria-describedby={`plan-filter-help ${modeDescriptionId}`}
      aria-keyshortcuts="n"
      data-filter-mode={excluded ? "exclude" : active ? "include" : "inactive"}
      title="Double-click or double-tap to exclude. Keyboard: N to exclude."
      onClick={(event) => {
        if (event.detail === 0) {
          clicks.current?.cancel();
          onActivate();
        } else {
          clicks.current ??= createFilterClicks({
            single: () => actions.current.onActivate(),
            double: () => actions.current.onExclude(),
          });
          clicks.current.click();
        }
      }}
      onPointerCancel={() => clicks.current?.cancel()}
      onDragStart={(event) => { event.preventDefault(); clicks.current?.cancel(); }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "n") return;
        event.preventDefault();
        clicks.current?.cancel();
        onExclude();
      }}
      className={cn(
        "inline-flex min-h-9 max-w-full touch-manipulation select-none items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors",
        excluded
          ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          : active
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-800",
      )}
    >
      {excluded && <Minus aria-hidden className="size-3 shrink-0" />}
      <span className="min-w-0 break-words">{value}</span>
      {removable && <X aria-hidden className="size-3 shrink-0" />}
      <span id={modeDescriptionId} className="sr-only">
        {excluded ? "Excludes matching recipes." : active ? "Includes matching recipes." : "Not applied."}
      </span>
    </button>
  );
}
