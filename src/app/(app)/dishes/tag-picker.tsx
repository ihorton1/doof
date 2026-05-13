"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";

export function TagPicker({
  initial,
  suggestions,
}: {
  initial?: string[];
  suggestions: string[];
}) {
  const [tags, setTags] = useState<string[]>(initial ?? []);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function add(raw: string) {
    const cleaned = raw.trim().toLowerCase().slice(0, 40);
    if (!cleaned) return;
    setTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    setInput("");
  }

  function remove(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (input.trim()) {
        e.preventDefault();
        add(input);
      }
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      e.preventDefault();
      setTags((prev) => prev.slice(0, -1));
    }
  }

  const q = input.trim().toLowerCase();
  const filtered = suggestions
    .filter((s) => !tags.includes(s))
    .filter((s) => q === "" || s.includes(q))
    .slice(0, 8);

  const showCreate =
    q.length > 0 && !suggestions.includes(q) && !tags.includes(q);
  const showDropdown = focused && (filtered.length > 0 || showCreate);

  return (
    <div className="space-y-2">
      {tags.map((t) => (
        <input key={t} type="hidden" name="tag" value={t} />
      ))}
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 items-center min-h-12 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-emerald-500">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="size-5 flex items-center justify-center rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800"
                aria-label={`Remove ${t}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              // Delay so a click on a suggestion fires before we tear down
              blurTimer.current = setTimeout(() => {
                if (input.trim()) add(input);
                setFocused(false);
              }, 150);
            }}
            placeholder={tags.length === 0 ? "Add tags…" : ""}
            autoComplete="off"
            className="flex-1 min-w-[100px] h-8 px-1 bg-transparent text-sm outline-none"
          />
        </div>
        {showDropdown && (
          <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {s}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(q);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400"
              >
                + Create &ldquo;{q}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Press Enter or comma to add. Tags are shared across dishes.
      </p>
    </div>
  );
}
