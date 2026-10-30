"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { dishTagSchema, MAX_TAG_LENGTH, type AddDishTagAction } from "@/lib/dish-tags";

export function QuickTagPicker({ dish, suggestions, addTagAction, onClose, onAdded }: {
  dish: { id: string; name: string; tags: string[] };
  suggestions: string[];
  addTagAction: AddDishTagAction;
  onClose: () => void;
  onAdded: (tag: string, duplicate: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();
  const errorId = useId();

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    input.current?.focus();
    return () => { el?.close(); };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quick-tag-title"
      onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!pending) onClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xs overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id="quick-tag-title" className="break-words text-xl font-extrabold text-emerald-800 dark:text-emerald-300">Tag {dish.name}</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Close tag picker" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="size-5" />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const parsed = dishTagSchema.safeParse({ dishId: dish.id, tag: name });
          if (!parsed.success) {
            setError("Enter a tag between 1 and 40 characters.");
            return;
          }
          setError("");
          startTransition(async () => {
            try {
              const result = await addTagAction(parsed.data);
              if ("error" in result) setError(result.error);
              else onAdded(result.tag, result.status === "already-tagged");
            } catch (cause) {
              console.error("Could not submit recipe tag", cause);
              setError("Could not reach the server. Please try again.");
            }
          });
        }}
        className="space-y-3"
      >
        <input
          ref={input}
          aria-label="Tag name"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={name}
          onChange={(event) => { setName(event.target.value); setError(""); }}
          required
          maxLength={MAX_TAG_LENGTH}
          disabled={pending}
          list={suggestionsId}
          autoComplete="off"
          placeholder="Add a tag..."
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <datalist id={suggestionsId}>
          {suggestions.filter(tag => !dish.tags.includes(tag)).map(tag => <option key={tag} value={tag} />)}
        </datalist>
        {error && <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={pending || !name.trim()} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {pending ? "Adding..." : "Add tag"}
        </button>
      </form>
    </dialog>
  );
}
