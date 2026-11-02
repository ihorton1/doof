"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type KeyboardEvent, type DragEvent, type PointerEvent } from "react";
import { Pencil } from "lucide-react";
import { createRecipeClicks } from "@/lib/recipe-clicks";
import { type ChooseDishAction } from "@/lib/planning-days";
import { type AddDishTagAction } from "@/lib/dish-tags";
import { DayPicker } from "../../plan/day-picker";
import { QuickTagPicker } from "../../plan/quick-tag-picker";

export type DishHeaderData = {
  id: string;
  name: string;
  description: string | null;
  servings: number | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  tags: string[];
};

export function DishHeader({ dish, todayIso, tagSuggestions, addDishAction, addTagAction }: {
  dish: DishHeaderData;
  todayIso: string;
  tagSuggestions: string[];
  addDishAction: ChooseDishAction;
  addTagAction: AddDishTagAction;
}) {
  const [dialog, setDialog] = useState<"plan" | "tag" | null>(null);
  const [message, setMessage] = useState({ text: "", screenReaderOnly: false });
  const helpId = useId();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const clicks = useMemo(() => createRecipeClicks<{ id: string }>({
    single: () => {},
    double: () => setDialog("plan"),
    triple: () => setDialog("tag"),
  }), []);

  useEffect(() => {
    const cancel = () => clicks.cancel();
    window.addEventListener("scroll", cancel, true);
    return () => { window.removeEventListener("scroll", cancel, true); cancel(); };
  }, [clicks, dish.id]);

  function open(next: "plan" | "tag") {
    clicks.cancel();
    setDialog(next);
  }

  const gestures = {
    "aria-describedby": helpId,
    "aria-keyshortcuts": "Enter Space t",
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        clicks.cancel();
        return;
      }
      if (event.detail === 0) open("plan");
      else if (dragged.current) clicks.cancel();
      else clicks.click(dish);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "t") return;
      event.preventDefault();
      open("tag");
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      pointerStart.current = { x: event.clientX, y: event.clientY };
      dragged.current = false;
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const start = pointerStart.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
        dragged.current = true;
        clicks.cancel();
      }
    },
    onPointerUp: () => { pointerStart.current = null; },
    onPointerCancel: () => { pointerStart.current = null; dragged.current = true; clicks.cancel(); },
    onDragStart: (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); dragged.current = true; clicks.cancel(); },
  };
  const actionClassName = "flex size-10 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

  return (
    <>
      <p id={helpId} className="sr-only">
        Double-tap the dish title or photo to choose a day to cook it. Triple-tap to add a tag.
        Keyboard: Enter or Space chooses a day; T adds a tag.
      </p>
      <div
        className="flex items-start justify-between gap-3"
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) clicks.cancel();
        }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            <button type="button" {...gestures} className="max-w-full touch-manipulation select-none break-words text-left focus-visible:outline-none focus-visible:underline">
              {dish.name}
            </button>
          </h1>
          {dish.description && <p className="mt-1 text-slate-600 dark:text-slate-400">{dish.description}</p>}
          {dish.servings && <p className="mt-1 text-sm text-slate-500">Serves {dish.servings}</p>}
          {dish.sourceUrl && (
            <a href={dish.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-emerald-600 hover:underline">Source</a>
          )}
          {dish.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dish.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/dishes?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-800"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Link href={`/dishes/${dish.id}/edit`} className={actionClassName} aria-label="Edit dish"><Pencil className="size-4" /></Link>
        </div>
      </div>
      {dish.imageUrl && (
        <button type="button" {...gestures} aria-label={`Plan or tag ${dish.name}`} className="block w-full touch-manipulation select-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dish.imageUrl} alt={dish.name} draggable={false} className="max-h-80 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800" />
        </button>
      )}
      <p role="status" className={message.screenReaderOnly ? "sr-only" : "text-sm text-emerald-700 empty:hidden dark:text-emerald-300"}>{message.text}</p>
      {dialog === "plan" && (
        <DayPicker
          dish={dish}
          todayIso={todayIso}
          addDishAction={addDishAction}
          onClose={() => setDialog(null)}
          onAdded={(label, duplicate) => {
            setMessage({ text: `${dish.name} ${duplicate ? "is already planned" : "added"} for ${label.toLowerCase()}.`, screenReaderOnly: false });
            setDialog(null);
          }}
        />
      )}
      {dialog === "tag" && (
        <QuickTagPicker
          dish={dish}
          suggestions={tagSuggestions}
          addTagAction={addTagAction}
          onClose={() => setDialog(null)}
          onAdded={(tag, duplicate) => {
            setMessage({ text: `${dish.name} ${duplicate ? "already has" : "tagged with"} "${tag}".`, screenReaderOnly: true });
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
