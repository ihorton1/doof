"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRecipeClicks } from "@/lib/recipe-clicks";
import { type AddDishTagAction } from "@/lib/dish-tags";
import { QuickTagPicker } from "../plan/quick-tag-picker";
import { type DismissLeftoversAction, type Leftover } from "@/lib/leftovers";
import { LeftoversView } from "./leftovers-view";
import { DishRatingControl } from "@/components/dish-rating-control";
import { DishRatingBadge } from "@/components/dish-rating-badge";
import type { DishRating, SetDishRatingAction } from "@/lib/dish-ratings";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const headingClassName =
  "block text-3xl md:text-xl font-extrabold leading-tight tracking-tight text-emerald-800 dark:text-emerald-300 break-words";

type Day = {
  iso: string;
  label: string;
  isToday: boolean;
  isFocus: boolean;
  entries: {
    id: string;
    dishId: string | null;
    dishName: string | null;
    dishRating: DishRating | null;
    dishTags: string[];
    dishImageUrl: string | null;
    freeformText: string | null;
    status: string;
  }[];
};

type TaggingDish = { id: string; name: string; tags: string[] };

export function TodayView({
  days,
  focusIso,
  prevFocusIso,
  nextFocusIso,
  addTagAction,
  setRatingAction,
  tagSuggestions,
  leftovers,
  dismissLeftoversAction,
  leftoversRefreshAt,
}: {
  days: Day[];
  focusIso: string;
  prevFocusIso: string;
  nextFocusIso: string;
  addTagAction: AddDishTagAction;
  setRatingAction: SetDishRatingAction;
  tagSuggestions: string[];
  leftovers: Leftover[];
  dismissLeftoversAction: DismissLeftoversAction;
  leftoversRefreshAt: number;
}) {
  const router = useRouter();
  const [tagging, setTagging] = useState<TaggingDish | null>(null);
  const [message, setMessage] = useState("");
  const clicks = useMemo(() => {
    const navigate = ({ href }: { href: string | null }) => {
      if (href) router.push(href);
    };
    return createRecipeClicks<TaggingDish & { href: string | null }>({
      single: navigate,
      double: navigate,
      triple: setTagging,
    });
  }, [router]);

  useEffect(() => () => clicks.cancel(), [clicks, focusIso]);

  function getDish(target: EventTarget) {
    if (!(target instanceof Element)) return null;
    if (target.closest("[data-rating-control]")) return null;
    const id = target.closest<HTMLElement>("[data-tag-dish]")?.dataset.tagDish;
    const entry = days.flatMap(day => day.entries).find(entry => entry.dishId === id);
    return entry?.dishId
      ? { id: entry.dishId, name: entry.dishName ?? "Recipe", tags: entry.dishTags }
      : null;
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 gap-4"
      onClickCapture={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.detail === 0) {
          clicks.cancel();
          return;
        }
        const dish = getDish(event.target);
        if (!dish || !(event.target instanceof Element)) {
          clicks.cancel();
          return;
        }
        // Capture before Next's links navigate so triple taps can finish.
        event.preventDefault();
        const href = event.target.closest("a")?.getAttribute("href") ?? null;
        clicks.click({ ...dish, href });
      }}
      onKeyDownCapture={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "t") return;
        const dish = getDish(event.target);
        if (!dish) return;
        event.preventDefault();
        clicks.cancel();
        setTagging(dish);
      }}
      onScrollCapture={() => clicks.cancel()}
      onPointerCancelCapture={() => clicks.cancel()}
      onDragStartCapture={() => clicks.cancel()}
    >
      <p id="today-tag-help" className="sr-only">Triple-tap a dish to add a tag. Keyboard: focus a meal card and press T.</p>
      <p role="status" className="sr-only">{message}</p>
      <MobileCarousel days={days} focusIso={focusIso} setRatingAction={setRatingAction} />

      <DesktopRow
        days={days}
        focusIso={focusIso}
        prevFocusIso={prevFocusIso}
        nextFocusIso={nextFocusIso}
        setRatingAction={setRatingAction}
      />
      <LeftoversView
        leftovers={leftovers}
        dismissAction={dismissLeftoversAction}
        refreshAt={leftoversRefreshAt}
      />
      {tagging && (
        <QuickTagPicker
          key={tagging.id}
          dish={tagging}
          suggestions={tagSuggestions}
          addTagAction={addTagAction}
          onClose={() => setTagging(null)}
          onAdded={(tag, duplicate) => {
            setMessage(`${tagging.name} ${duplicate ? "already has" : "tagged with"} "${tag}".`);
            setTagging(null);
          }}
        />
      )}
    </div>
  );
}

function MobileCarousel({ days, focusIso, setRatingAction }: { days: Day[]; focusIso: string; setRatingAction: SetDishRatingAction }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = focusRef.current;
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;

    const center = () => {
      const focused = focusRef.current;
      const sc = scrollerRef.current;
      if (!focused || !sc || sc.clientWidth === 0) return;
      // Use bounding rects — works regardless of offsetParent / positioning.
      const scRect = sc.getBoundingClientRect();
      const elRect = focused.getBoundingClientRect();
      const delta = elRect.left - scRect.left - (sc.clientWidth - elRect.width) / 2;
      const target = sc.scrollLeft + delta;
      // Disable snap during programmatic scroll so iOS doesn't override.
      const prevSnap = sc.style.scrollSnapType;
      sc.style.scrollSnapType = "none";
      sc.scrollLeft = Math.max(0, target);
      void sc.offsetWidth;
      requestAnimationFrame(() => {
        sc.style.scrollSnapType = prevSnap || "";
      });
    };

    center();
    const r1 = requestAnimationFrame(center);
    const t1 = window.setTimeout(center, 50);
    const t2 = window.setTimeout(center, 200);
    const t3 = window.setTimeout(center, 600);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(center);
    });
    ro.observe(scroller);
    window.addEventListener("orientationchange", center);

    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener("orientationchange", center);
    };
  }, [focusIso]);

  return (
    <div className="md:hidden -mx-4">
      <div
        ref={scrollerRef}
        className="flex items-stretch gap-4 overflow-x-auto snap-x snap-mandatory px-[7%] py-2 no-scrollbar"
      >
        {days.map((day) => (
          <div
            key={day.iso}
            ref={day.iso === focusIso ? focusRef : undefined}
            className="snap-center shrink-0 w-[86vw] h-[calc(100svh-11rem)] min-h-[26rem] max-h-[52rem]"
          >
            <DayCard day={day} emphasized={day.iso === focusIso} setRatingAction={setRatingAction} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopRow({
  days,
  focusIso,
  prevFocusIso,
  nextFocusIso,
  setRatingAction,
}: {
  days: Day[];
  focusIso: string;
  prevFocusIso: string;
  nextFocusIso: string;
  setRatingAction: SetDishRatingAction;
}) {
  const focusIdx = days.findIndex((d) => d.iso === focusIso);
  const prev = days[focusIdx - 1];
  const focus = days[focusIdx];
  const next = days[focusIdx + 1];

  return (
    <div className="hidden md:flex flex-1 min-h-0 py-2">
      <div className="flex items-center gap-3 w-full">
        <PagerButton href={`/today?d=${prevFocusIso}`} dir="prev" />

        <div className="min-w-0 flex-1 grid grid-cols-[1fr_1.4fr_1fr] gap-3 items-stretch h-[calc(100svh-11rem)] min-h-[26rem] max-h-[52rem]">
          {prev ? <DayCardLink day={prev} dim setRatingAction={setRatingAction} /> : <div />}
          <DayCard day={focus} emphasized setRatingAction={setRatingAction} />
          {next ? <DayCardLink day={next} dim setRatingAction={setRatingAction} /> : <div />}
        </div>

        <PagerButton href={`/today?d=${nextFocusIso}`} dir="next" />
      </div>
    </div>
  );
}

function PagerButton({ href, dir }: { href: string; dir: "prev" | "next" }) {
  return (
    <Link
      href={href}
      aria-label={dir === "prev" ? "Previous day" : "Next day"}
      className="self-center shrink-0 h-10 w-10 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </Link>
  );
}

function DayCardLink({ day, dim, setRatingAction }: { day: Day; dim?: boolean; setRatingAction: SetDishRatingAction }) {
  return (
    <Link
      href={`/today?d=${day.iso}`}
      className={cn(
        "block min-w-0 h-full rounded-[2rem] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500",
        dim && "opacity-60 hover:opacity-100",
      )}
    >
      <DayCard day={day} inLink setRatingAction={setRatingAction} />
    </Link>
  );
}

function DayCard({
  day,
  emphasized,
  inLink,
  setRatingAction,
}: {
  day: Day;
  emphasized?: boolean;
  inLink?: boolean;
  setRatingAction: SetDishRatingAction;
}) {
  return (
    <div className="relative min-w-0 h-full flex flex-col gap-3">
      <h2
        className={cn(headingClassName, "shrink-0 text-center")}
      >
        {day.label}
      </h2>
      <div
        tabIndex={day.entries.length > 0 && !inLink ? 0 : undefined}
        role={day.entries.length > 0 ? "region" : undefined}
        aria-label={day.entries.length > 0 ? `${day.label} meals` : undefined}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto [contain:layout_paint] no-scrollbar focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-500",
          day.entries.length > 0
            ? "grid gap-4 snap-y snap-proximity rounded-[2rem]"
            : cn(
                "flex items-center justify-center text-center rounded-[2rem] border bg-white dark:bg-slate-900",
                emphasized
                  ? "border-emerald-500/40 shadow-sm"
                  : "border-slate-200 dark:border-slate-800",
              ),
          day.entries.length > 1
            ? "auto-rows-[minmax(90%,auto)]"
            : "auto-rows-[minmax(100%,auto)]",
        )}
      >
        {day.entries.length > 0 ? (
          <PlannedMeals day={day} inLink={inLink} emphasized={emphasized} setRatingAction={setRatingAction} />
        ) : (
          <EmptyMeal day={day} inLink={inLink} />
        )}
      </div>
    </div>
  );
}

function PlannedMeals({
  day,
  inLink,
  emphasized,
  setRatingAction,
}: {
  day: Day;
  inLink?: boolean;
  emphasized?: boolean;
  setRatingAction: SetDishRatingAction;
}) {
  return (
    <>
      {day.entries.map((entry) => {
        const title = entry.dishName ?? entry.freeformText ?? "—";
        const showRating = Boolean(entry.dishId) && (!inLink || entry.dishRating !== null);
        const titleClassName = cn(
          headingClassName,
          entry.status === "skipped" && "line-through opacity-60",
        );
        const titleNode =
          entry.dishId && !inLink ? (
            <Link
              href={`/dishes/${entry.dishId}`}
              className={`${titleClassName} hover:underline`}
            >
              {title}
            </Link>
          ) : (
            <span className={titleClassName}>{title}</span>
          );

        return (
          <article
            key={entry.id}
            aria-label={title}
            data-tag-dish={entry.dishId ?? undefined}
            tabIndex={entry.dishId && !inLink ? 0 : undefined}
            aria-keyshortcuts={entry.dishId && !inLink ? "t" : undefined}
            aria-describedby={entry.dishId ? "today-tag-help" : undefined}
            className={cn(
              "flex min-w-0 touch-manipulation select-none flex-col gap-4 snap-start rounded-[2rem] border bg-white p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:bg-slate-900 md:p-3",
              emphasized
                ? "border-emerald-500/40 shadow-sm"
                : "border-slate-200 dark:border-slate-800",
            )}
          >
            <div className="min-h-24 flex-1 basis-0 overflow-hidden rounded-[1.25rem] bg-slate-100 dark:bg-slate-800">
              {entry.dishImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={entry.dishImageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <UtensilsCrossed className="size-12 text-slate-300 dark:text-slate-600" aria-hidden />
                </div>
              )}
            </div>
            <h3>{titleNode}</h3>
            {(showRating || entry.dishTags.length > 0) && (
              <ul aria-label="Recipe rating and tags" className="flex flex-wrap items-center gap-2 pb-1">
                {showRating && entry.dishId && (
                  <li>
                    {inLink ? (
                      <DishRatingBadge rating={entry.dishRating} />
                    ) : (
                      <DishRatingControl
                        dish={{ id: entry.dishId, name: title, rating: entry.dishRating }}
                        setRatingAction={setRatingAction}
                      />
                    )}
                  </li>
                )}
                {entry.dishTags.map((tag) => (
                  <li
                    key={tag}
                    className="max-w-full break-words rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 md:px-3 md:py-1.5 md:text-xs"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </>
  );
}

function EmptyMeal({ day, inLink }: { day: Day; inLink?: boolean }) {
  return (
    <div className="text-slate-400 text-sm space-y-2">
      <UtensilsCrossed className="size-8 mx-auto opacity-30" />
      <div>Nothing planned</div>
      {!inLink && (
        <Link
          href="/meals"
          className="text-emerald-600 hover:underline text-sm font-medium inline-block"
        >
          {day.isToday ? "Plan dinner →" : "Add a dish →"}
        </Link>
      )}
    </div>
  );
}
