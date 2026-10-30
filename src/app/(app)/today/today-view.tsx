"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

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
    dishTags: string[];
    dishImageUrl: string | null;
    freeformText: string | null;
    status: string;
  }[];
};

export function TodayView({
  days,
  focusIso,
  prevFocusIso,
  nextFocusIso,
}: {
  days: Day[];
  focusIso: string;
  prevFocusIso: string;
  nextFocusIso: string;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <MobileCarousel days={days} focusIso={focusIso} />

      <DesktopRow
        days={days}
        focusIso={focusIso}
        prevFocusIso={prevFocusIso}
        nextFocusIso={nextFocusIso}
      />
    </div>
  );
}

function MobileCarousel({ days, focusIso }: { days: Day[]; focusIso: string }) {
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
            <DayCard day={day} emphasized={day.iso === focusIso} />
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
}: {
  days: Day[];
  focusIso: string;
  prevFocusIso: string;
  nextFocusIso: string;
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
          {prev ? <DayCardLink day={prev} dim /> : <div />}
          <DayCard day={focus} emphasized />
          {next ? <DayCardLink day={next} dim /> : <div />}
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

function DayCardLink({ day, dim }: { day: Day; dim?: boolean }) {
  return (
    <Link
      href={`/today?d=${day.iso}`}
      className={cn(
        "block min-w-0 h-full rounded-[2rem] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500",
        dim && "opacity-60 hover:opacity-100",
      )}
    >
      <DayCard day={day} inLink />
    </Link>
  );
}

function DayCard({
  day,
  emphasized,
  inLink,
}: {
  day: Day;
  emphasized?: boolean;
  inLink?: boolean;
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
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-500",
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
          <PlannedMeals day={day} inLink={inLink} emphasized={emphasized} />
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
}: {
  day: Day;
  inLink?: boolean;
  emphasized?: boolean;
}) {
  return (
    <>
      {day.entries.map((entry) => {
        const title = entry.dishName ?? entry.freeformText ?? "—";
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
            className={cn(
              "flex min-w-0 flex-col gap-4 snap-start rounded-[2rem] border bg-white p-5 dark:bg-slate-900 md:p-3",
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
            {entry.dishTags.length > 0 && (
              <ul aria-label="Recipe tags" className="flex flex-wrap gap-2 pb-1">
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
