"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from "react";
import { getTagOptions } from "@/lib/dish-tags";
import { cn } from "@/lib/utils";

type TagAutocompleteProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onSelect" | "children" | "list"> & {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  suggestions: string[];
  selected: string[];
  inputRef?: RefObject<HTMLInputElement | null>;
  controlClassName?: string;
  inlineSuggestions?: boolean;
  children?: ReactNode;
};

export function TagAutocomplete({
  value, onChange, onSelect, suggestions, selected, inputRef,
  controlClassName, inlineSuggestions = false, children,
  onKeyDown, onFocus, onBlur, disabled, ...props
}: TagAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const options = getTagOptions(value, suggestions, selected);
  const expanded = open && !disabled && options.length > 0;
  const active = expanded && activeIndex >= 0 && activeIndex < options.length ? activeIndex : -1;

  useEffect(() => {
    if (expanded && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [expanded, active]);

  function choose(tag: string) {
    onSelect(tag);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <div className={controlClassName ?? "flex"}>
        {children}
        <input
          {...props}
          ref={inputRef}
          role="combobox"
          value={value}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            setOpen(true);
            setActiveIndex(-1);
            onChange(event.target.value);
          }}
          onFocus={(event) => { setOpen(true); setActiveIndex(-1); onFocus?.(event); }}
          onBlur={(event) => { setOpen(false); setActiveIndex(-1); onBlur?.(event); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(event.key === "ArrowDown"
                ? (active + 1) % options.length
                : active <= 0 ? options.length - 1 : active - 1);
              return;
            }
            if (event.key === "Enter" && active >= 0) {
              event.preventDefault();
              choose(options[active].value);
              return;
            }
            if (event.key === "Escape") {
              onKeyDown?.(event);
              if (expanded) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setActiveIndex(-1);
              }
              return;
            }
            onKeyDown?.(event);
          }}
        />
      </div>
      {expanded && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className={cn(
            "z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
            !inlineSuggestions && "absolute inset-x-0",
          )}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={active === index}
              tabIndex={-1}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
              className={cn(
                "block w-full break-words px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800",
                active === index && "bg-slate-100 dark:bg-slate-800",
                option.create && "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {option.create ? <>+ Create &ldquo;{option.value}&rdquo;</> : option.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
