"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";
import { normalizeTag } from "@/lib/dish-tags";
import { TagAutocomplete } from "@/components/tag-autocomplete";

export function TagPicker({
  initial,
  suggestions,
}: {
  initial?: string[];
  suggestions: string[];
}) {
  const [tags, setTags] = useState<string[]>(initial ?? []);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelBlur = useRef(false);

  function add(raw: string) {
    const cleaned = normalizeTag(raw);
    if (!cleaned) return;
    setTags((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    setInput("");
  }

  function remove(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      cancelBlur.current = true;
      setInput("");
      inputRef.current?.blur();
    } else if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (input.trim()) {
        e.preventDefault();
        add(input);
      }
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      e.preventDefault();
      setTags((prev) => prev.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      {tags.map((t) => (
        <input key={t} type="hidden" name="tag" value={t} />
      ))}
      <TagAutocomplete
        inputRef={inputRef}
        aria-label="Add tags"
        value={input}
        onChange={setInput}
        onSelect={(value) => { add(value); inputRef.current?.focus(); }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (cancelBlur.current) cancelBlur.current = false;
          else if (input.trim()) add(input);
        }}
        suggestions={suggestions}
        selected={tags}
        placeholder={tags.length === 0 ? "Add tags…" : ""}
        className="flex-1 min-w-[100px] h-8 px-1 bg-transparent text-sm outline-none"
        controlClassName="flex flex-wrap gap-1.5 items-center min-h-12 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-emerald-500"
      >
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
      </TagAutocomplete>
      <p className="text-xs text-slate-500">
        Press Enter or comma to add. Tags are shared across dishes.
      </p>
    </div>
  );
}
