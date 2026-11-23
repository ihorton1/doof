"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { DishForm } from "../dish-form";
import { createDish } from "../actions";
import { PEEK_DRAFT_PREFIX, recipePeekDraftSchema, recipePeekInitial } from "@/lib/recipe-peek";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function NewDishForm({ peekId, suggestions }: {
  peekId?: string;
  suggestions: { names: string[]; units: string[]; tags: string[] };
}) {
  const getSnapshot = useCallback(() => {
    if (!peekId || !/^[\da-f-]{36}$/i.test(peekId)) return null;
    try {
      return sessionStorage.getItem(`${PEEK_DRAFT_PREFIX}${peekId}`);
    } catch (cause) {
      console.error("Could not access recipe preview draft storage", cause);
      return null;
    }
  }, [peekId]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  const { draft, error } = useMemo(() => {
    if (!peekId || raw === undefined) return { draft: null, error: "" };
    try {
      if (!raw) throw new Error("The preview draft is no longer available.");
      const parsed = recipePeekDraftSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error("The preview draft could not be read.");
      return { draft: recipePeekInitial(parsed.data), error: "" };
    } catch (cause) {
      console.error("Could not load recipe preview draft", cause);
      return { draft: null, error: "This preview draft is unavailable. Return to Dishes and peek again, or add the dish manually." };
    }
  }, [raw, peekId]);

  if (peekId && !draft && !error) return <p role="status">Opening your recipe draft...</p>;

  return (
    <>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error} <Link href="/dishes" className="underline">Return to Dishes</Link></p>}
      {draft && <p className="text-sm text-slate-500 dark:text-slate-400">From your preview. Review the original ingredient sentences below and apply your changes before saving. Any available image is already selected, and the method is in Notes. Nothing has been saved yet.</p>}
      {draft?.needsIngredientReview && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Some ingredient fields need shortening before saving. The full extracted text is preserved below for review.</p>}
      <DishForm action={createDish} initial={draft?.initial} initialRecipe={draft?.importRecipe} suggestions={suggestions} skipInitialUrlPreview={Boolean(draft)} />
    </>
  );
}
