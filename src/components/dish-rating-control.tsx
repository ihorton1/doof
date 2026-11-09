"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { DISH_RATINGS, dishRatingClasses, type DishRating, type SetDishRatingAction } from "@/lib/dish-ratings";
import { DishRatingBadge } from "./dish-rating-badge";

export function DishRatingOptions({ rating, onChange, disabled = false }: {
  rating: DishRating | null;
  onChange: (rating: DishRating | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Dish rating" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DISH_RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            data-rating-choice
            aria-pressed={rating === value}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 ${dishRatingClasses[value]} ${rating === value ? "ring-2 ring-current ring-inset" : ""}`}
          >
            {rating === value && <Check className="size-4" aria-hidden />}
            {value}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || rating === null}
        onClick={() => onChange(null)}
        className="min-h-11 rounded-lg px-3 text-sm text-slate-600 underline underline-offset-2 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Clear rating
      </button>
    </div>
  );
}

export function DishRatingControl({ dish, setRatingAction }: {
  dish: { id: string; name: string; rating: DishRating | null };
  setRatingAction: SetDishRatingAction;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div data-rating-control className="w-fit">
      <button
        type="button"
        aria-label={dish.rating ? `Change rating for ${dish.name}: ${dish.rating}` : `Rate ${dish.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        {dish.rating ? <DishRatingBadge rating={dish.rating} /> : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Rate dish</span>
        )}
      </button>
      <p role="status" className="sr-only">{message}</p>
      {open && (
        <DishRatingPicker
          dish={dish}
          setRatingAction={setRatingAction}
          onClose={() => setOpen(false)}
          onSaved={(rating) => {
            setMessage(rating ? `${dish.name} rated ${rating}.` : `Rating cleared for ${dish.name}.`);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DishRatingPicker({ dish, setRatingAction, onClose, onSaved }: {
  dish: { id: string; name: string; rating: DishRating | null };
  setRatingAction: SetDishRatingAction;
  onClose: () => void;
  onSaved: (rating: DishRating | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const titleId = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const choice = el?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?? el?.querySelector<HTMLButtonElement>("[data-rating-choice]");
    choice?.focus();
    return () => { el?.close(); };
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving.current) close();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="min-w-0 break-words text-xl font-extrabold text-emerald-800 dark:text-emerald-300">Rate {dish.name}</h2>
        <button type="button" disabled={pending} onClick={close} aria-label="Close rating picker" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <DishRatingOptions
        rating={dish.rating}
        disabled={pending}
        onChange={(rating) => {
          if (saving.current) return;
          saving.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await setRatingAction({ dishId: dish.id, rating });
              if ("error" in result) setError(result.error);
              else {
                dialog.current?.close();
                onSaved(result.rating);
              }
            } catch (cause) {
              console.error("Could not submit dish rating", cause);
              setError("Could not reach the server. Please try again.");
            } finally {
              saving.current = false;
            }
          });
        }}
      />
      {pending && <p role="status" className="text-sm text-slate-500">Saving rating...</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </dialog>
  );
}
