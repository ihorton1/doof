"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { UtensilsCrossed, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlanningDays, type ChooseDishAction } from "@/lib/planning-days";

export type SavedDish = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
};

type RecipeCarouselProps = {
  dishes: SavedDish[];
  todayIso: string;
  addDishAction: ChooseDishAction;
};

export function RecipeCarousel({ dishes, todayIso, addDishAction }: RecipeCarouselProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const tags = [...new Set(dishes.flatMap(dish => dish.tags))]
    .sort((a, b) => a.localeCompare(b));
  const filtered = activeTag ? dishes.filter(dish => dish.tags.includes(activeTag)) : dishes;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">Plan</h1>
      {tags.length > 0 && (
        <div role="group" aria-label="Filter recipes by tag" className="flex flex-wrap justify-center gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={cn(
                "min-h-9 rounded-full px-3 py-2 text-xs font-medium transition-colors",
                activeTag === tag
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-800",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      <RecipeCards key={activeTag === null ? "all" : `tag:${activeTag}`} dishes={filtered} todayIso={todayIso} addDishAction={addDishAction} />
    </div>
  );
}

function RecipeCards({ dishes, todayIso, addDishAction }: RecipeCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<SavedDish | null>(null);
  const [message, setMessage] = useState("");
  const pendingClick = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => () => {
    if (pendingClick.current) clearTimeout(pendingClick.current.timer);
  }, []);

  function cancelClick() {
    if (pendingClick.current) clearTimeout(pendingClick.current.timer);
    pendingClick.current = null;
  }

  function openRecipe(event: MouseEvent<HTMLAnchorElement>, dish: SavedDish) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.detail === 0) {
      cancelClick();
      return;
    }
    event.preventDefault();
    if (pendingClick.current?.id === dish.id) {
      cancelClick();
      setSelected(dish);
    } else {
      cancelClick();
      pendingClick.current = {
        id: dish.id,
        timer: setTimeout(() => {
          pendingClick.current = null;
          router.push(`/dishes/${dish.id}`);
        }, 400),
      };
    }
  }

  function navigate(index: number) {
    cancelClick();
    const container = scroller.current;
    const card = container?.children[index];
    if (!container || !(card instanceof HTMLElement)) return;
    container.scrollTo({
      left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  if (dishes.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="my-4 text-slate-500">Save a dish first, then choose when to cook it here.</p>
        <Link href="/dishes/new" className="font-medium text-emerald-600 hover:underline">Add your first dish</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p id="recipe-carousel-help" className="sr-only">
        Keyboard: Enter views the recipe; Space chooses a day.
      </p>
      <p role="status" className="text-center text-sm text-emerald-700 empty:hidden dark:text-emerald-300">{message}</p>
      <div className="-mx-4">
        <div
          ref={scroller}
          role="region"
          aria-label="Saved dishes"
          aria-roledescription="carousel"
          aria-describedby="recipe-carousel-help"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              navigate(Math.max(0, Math.min(dishes.length - 1, active + (event.key === "ArrowRight" ? 1 : -1))));
            }
          }}
          onScroll={() => {
            const el = scroller.current;
            if (!el) return;
            const center = el.scrollLeft + el.clientWidth / 2;
            let closest = 0;
            let distance = Infinity;
            Array.from(el.children).forEach((child, index) => {
              if (!(child instanceof HTMLElement)) return;
              const next = Math.abs(child.offsetLeft + child.clientWidth / 2 - center);
              if (next < distance) { distance = next; closest = index; }
            });
            setActive(closest);
          }}
          className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[7%] py-2 no-scrollbar focus-visible:outline-2 focus-visible:outline-slate-400"
        >
          {dishes.map((dish, index) => (
            <article
              key={dish.id}
              aria-label={dish.name}
              aria-roledescription="slide"
              className={cn(
                "h-[calc(100svh-17rem)] min-h-[25rem] max-h-[48rem] w-full shrink-0 snap-center overflow-y-auto rounded-[2rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
                index === active && "shadow-sm",
              )}
            >
              <Link
                href={`/dishes/${dish.id}`}
                aria-label={dish.name}
                aria-describedby="recipe-carousel-help"
                aria-keyshortcuts="Space"
                onClick={(event) => openRecipe(event, dish)}
                onPointerCancel={cancelClick}
                onDragStart={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    cancelClick();
                    setSelected(dish);
                  }
                }}
                className="flex min-h-full touch-manipulation select-none flex-col gap-4 rounded-[2rem] p-5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-slate-400"
              >
              <div className="min-h-32 flex-1 basis-0 overflow-hidden rounded-[1.25rem] bg-slate-100 dark:bg-slate-800">
                {dish.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={dish.imageUrl} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <UtensilsCrossed className="size-12 text-slate-300 dark:text-slate-600" aria-hidden />
                  </div>
                )}
              </div>
              <h2 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-emerald-800 dark:text-emerald-300 md:text-xl">{dish.name}</h2>
              {dish.description && <p className="text-sm text-slate-500 dark:text-slate-400">{dish.description}</p>}
              {dish.tags.length > 0 && (
                <ul aria-label="Recipe tags" className="flex flex-wrap gap-2">
                  {dish.tags.map(tag => <li key={tag} className="break-words rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{tag}</li>)}
                </ul>
              )}
              </Link>
            </article>
          ))}
        </div>
      </div>
      {selected && (
        <DayPicker
          key={selected.id}
          dish={selected}
          todayIso={todayIso}
          addDishAction={addDishAction}
          onClose={() => setSelected(null)}
          onAdded={(label, duplicate) => {
            setMessage(`${selected.name} ${duplicate ? "is already planned" : "added"} for ${label.toLowerCase()}.`);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function DayPicker({ dish, todayIso, addDishAction, onClose, onAdded }: {
  dish: SavedDish;
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
