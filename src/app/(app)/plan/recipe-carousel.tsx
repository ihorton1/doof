"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { Search, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDishSearchSuggestions } from "@/lib/dish-search";
import { filterPlanDishes, getPopularPlanTags, type PlanFilter } from "@/lib/plan-dish-filters";
import { type ChooseDishAction } from "@/lib/planning-days";
import { type AddDishTagAction } from "@/lib/dish-tags";
import { createRecipeClicks } from "@/lib/recipe-clicks";
import { QuickTagPicker } from "./quick-tag-picker";
import { FilterBubble } from "./filter-bubble";
import { DayPicker } from "./day-picker";

export type SavedDish = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  ingredientNames: string[];
};

type RecipeCarouselProps = {
  dishes: SavedDish[];
  todayIso: string;
  addDishAction: ChooseDishAction;
  addTagAction: AddDishTagAction;
  tagSuggestions: string[];
};

export function RecipeCarousel({ dishes, todayIso, addDishAction, addTagAction, tagSuggestions }: RecipeCarouselProps) {
  const [tagFilters, setTagFilters] = useState<PlanFilter[]>([]);
  const [query, setQuery] = useState("");
  const [queries, setQueries] = useState<PlanFilter[]>([]);
  const [filterResetVersion, setFilterResetVersion] = useState(0);
  const [filterError, setFilterError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();
  const errorId = useId();
  const suggestions = useMemo(() => getDishSearchSuggestions(dishes), [dishes]);
  const tags = useMemo(() => getPopularPlanTags(dishes), [dishes]);
  const filtered = filterPlanDishes(dishes, tagFilters, queries);

  function excludeFilter(current: PlanFilter[], value: string): PlanFilter[] {
    return current.some(filter => filter.value === value)
      ? current.map(filter => filter.value === value ? { ...filter, exclude: true } : filter)
      : [...current, { value, exclude: true }];
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">Plan</h1>
      {dishes.length > 0 && (
        <form
          aria-label="Add recipe filter"
          onSubmit={(event) => {
            event.preventDefault();
            const value = query.trim();
            if (!value) {
              setFilterError("Enter a dish, ingredient or tag.");
              return;
            }
            if (queries.some(existing => existing.value.toLocaleLowerCase() === value.toLocaleLowerCase())) {
              setFilterError("That filter is already added.");
              return;
            }
            setQueries(current => [...current, { value, exclude: false }]);
            setQuery("");
            setFilterError("");
            input.current?.focus();
          }}
          className="space-y-2"
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={input}
                type="search"
                required
                value={query}
                onChange={(event) => { setQuery(event.target.value); setFilterError(""); }}
                placeholder="Filter by dish, ingredient or tag..."
                aria-label="Filter by dish, ingredient or tag"
                aria-invalid={Boolean(filterError)}
                aria-describedby={filterError ? errorId : undefined}
                list={query ? suggestionsId : undefined}
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <datalist id={suggestionsId}>
                {suggestions.map(value => <option key={value} value={value} />)}
              </datalist>
            </div>
            <button type="submit" disabled={!query.trim()} className="min-h-11 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Add filter
            </button>
          </div>
          {filterError && <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">{filterError}</p>}
        </form>
      )}
      {tags.length > 0 && (
        <div role="group" aria-label="Filter recipes by tag" className="flex flex-wrap justify-center gap-2">
          {tags.map(tag => (
            <FilterBubble
              key={tag}
              value={tag}
              active={tagFilters.some(filter => filter.value === tag)}
              excluded={tagFilters.some(filter => filter.value === tag && filter.exclude)}
              resetVersion={filterResetVersion}
              onActivate={() => setTagFilters(current => current.some(filter => filter.value === tag)
                ? current.filter(filter => filter.value !== tag)
                : [...current, { value: tag, exclude: false }])}
              onExclude={() => setTagFilters(current => excludeFilter(current, tag))}
            />
          ))}
        </div>
      )}
      {dishes.length > 0 && (
        <p id="plan-filter-help" className="sr-only">
          Double-tap/click a bubble to exclude matches. Single-click active tags to clear them or custom filters to remove them.
          Keyboard: N excludes; Enter or Space selects or clears.
        </p>
      )}
      {(queries.length > 0 || tagFilters.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {queries.length > 0 && (
            <ul aria-label="Ad hoc filters" className="flex min-w-0 flex-wrap justify-center gap-2">
              {queries.map(({ value, exclude }) => (
                <li key={value} className="min-w-0 max-w-full">
                  <FilterBubble
                    value={value}
                    active
                    excluded={exclude}
                    removable
                    resetVersion={filterResetVersion}
                    onActivate={() => {
                      setQueries(current => current.filter(query => query.value !== value));
                      setFilterError("");
                      input.current?.focus();
                    }}
                    onExclude={() => setQueries(current => excludeFilter(current, value))}
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setTagFilters([]);
              setQueries([]);
              setQuery("");
              setFilterError("");
              setFilterResetVersion(version => version + 1);
              input.current?.focus();
            }}
            className="min-h-9 px-2 text-xs text-slate-500 underline dark:text-slate-400"
          >
            Clear filters
          </button>
        </div>
      )}
      {dishes.length > 0 && filtered.length === 0 ? (
        <p role="status" className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No recipes match these filters.
        </p>
      ) : (
        <RecipeCards key={JSON.stringify([tagFilters, queries])} dishes={filtered} todayIso={todayIso} addDishAction={addDishAction} addTagAction={addTagAction} tagSuggestions={tagSuggestions} />
      )}
    </div>
  );
}

function RecipeCards({ dishes, todayIso, addDishAction, addTagAction, tagSuggestions }: RecipeCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<SavedDish | null>(null);
  const [tagging, setTagging] = useState<SavedDish | null>(null);
  const [message, setMessage] = useState({ text: "", screenReaderOnly: false });
  const clicks = useMemo(() => createRecipeClicks<SavedDish>({
    single: dish => router.push(`/dishes/${dish.id}`),
    double: setSelected,
    triple: setTagging,
  }), [router]);
  const cancelClick = clicks.cancel;

  useEffect(() => () => clicks.cancel(), [clicks]);

  function openRecipe(event: MouseEvent<HTMLAnchorElement>, dish: SavedDish) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.detail === 0) {
      cancelClick();
      return;
    }
    event.preventDefault();
    clicks.click(dish);
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
        Keyboard: Enter views the recipe; Space chooses a day; T adds a tag.
      </p>
      <p role="status" className={message.screenReaderOnly ? "sr-only" : "text-center text-sm text-emerald-700 empty:hidden dark:text-emerald-300"}>{message.text}</p>
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
            cancelClick();
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
          className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[7%] py-2 no-scrollbar focus-visible:outline-none focus-visible:[&_[data-active=true]_h2]:underline"
        >
          {dishes.map((dish, index) => (
            <article
              key={dish.id}
              aria-label={dish.name}
              aria-roledescription="slide"
              data-active={index === active}
              onScroll={cancelClick}
              className={cn(
                "h-[calc(100svh-17rem)] min-h-[25rem] max-h-[48rem] w-full shrink-0 snap-center overflow-y-auto rounded-[2rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
                index === active && "shadow-sm",
              )}
            >
              <Link
                href={`/dishes/${dish.id}`}
                aria-label={dish.name}
                aria-describedby="recipe-carousel-help"
                aria-keyshortcuts="Space t"
                onClick={(event) => openRecipe(event, dish)}
                onPointerCancel={cancelClick}
                onDragStart={(event) => { event.preventDefault(); cancelClick(); }}
                onKeyDown={(event) => {
                  if (event.altKey || event.ctrlKey || event.metaKey) return;
                  if (event.key === " " || event.key.toLowerCase() === "t") {
                    event.preventDefault();
                    cancelClick();
                    if (event.key === " ") setSelected(dish);
                    else setTagging(dish);
                  }
                }}
                className="flex h-full touch-manipulation select-none flex-col gap-4 rounded-[2rem] p-5 focus-visible:outline-none focus-visible:[&_h2]:underline"
              >
                <div className="relative min-h-32 flex-1 basis-0 overflow-hidden rounded-[1.25rem] bg-slate-100 dark:bg-slate-800">
                  {dish.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={dish.imageUrl} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
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
            setMessage({
              text: `${selected.name} ${duplicate ? "is already planned" : "added"} for ${label.toLowerCase()}.`,
              screenReaderOnly: false,
            });
            setSelected(null);
          }}
        />
      )}
      {tagging && (
        <QuickTagPicker
          key={tagging.id}
          dish={tagging}
          suggestions={tagSuggestions}
          addTagAction={addTagAction}
          onClose={() => setTagging(null)}
          onAdded={(tag, duplicate) => {
            setMessage({
              text: `${tagging.name} ${duplicate ? "already has" : "tagged with"} "${tag}".`,
              screenReaderOnly: true,
            });
            setTagging(null);
          }}
        />
      )}
    </div>
  );
}
