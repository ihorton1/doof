"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type Day = {
  iso: string;
  label: string;
  isToday: boolean;
  isFocus: boolean;
  entries: {
    id: string;
    dishId: string | null;
    dishName: string | null;
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
    <div className="md:hidden flex-1 min-h-0 -mx-4">
      <div
        ref={scrollerRef}
        className="h-full flex items-center gap-3 overflow-x-auto overflow-y-hidden snap-x snap-mandatory px-[15%] no-scrollbar"
      >
        {days.map((day) => (
          <div
            key={day.iso}
            ref={day.iso === focusIso ? focusRef : undefined}
            className="snap-center shrink-0 w-[70%] h-3/4 py-1"
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
    <div className="hidden md:flex flex-1 min-h-0">
      <div className="flex items-center gap-4 w-full h-full">
        <PagerButton href={`/today?d=${prevFocusIso}`} dir="prev" />

        <div className="flex-1 grid grid-cols-3 gap-4 items-stretch h-3/4">
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
      className="self-center h-10 w-10 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
        "block h-full transition-opacity",
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
    <div
      className={cn(
        "relative h-full rounded-2xl border overflow-hidden flex flex-col",
        "bg-white dark:bg-slate-900",
        emphasized
          ? "border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-sm"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      <div className="relative flex flex-col h-full p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className={cn(
              "font-semibold",
              day.isToday ? "text-emerald-600 dark:text-emerald-400" : "",
            )}
          >
            {day.label}
          </h2>
          <span
            className={cn(
              "text-xs",
              "text-slate-400",
            )}
          >
            {day.iso}
          </span>
        </div>

        <div
          className={cn(
            "flex-1 flex flex-col",
            day.entries.length > 0
              ? "items-stretch justify-stretch -mx-5 -mb-5"
              : "items-center justify-center text-center",
          )}
        >
          {day.entries.length > 0 ? (
            <PlannedMeals day={day} inLink={inLink} />
          ) : (
            <EmptyMeal day={day} inLink={inLink} />
          )}
        </div>
      </div>
    </div>
  );
}

function PlannedMeals({
  day,
  inLink,
}: {
  day: Day;
  inLink?: boolean;
}) {
  return (
    <div
      className="grid h-full min-h-0 w-full"
      style={{
        gridTemplateRows: `repeat(${day.entries.length}, minmax(0, 1fr))`,
      }}
    >
      {day.entries.map((entry) => {
        const title = entry.dishName ?? entry.freeformText ?? "—";
        const titleClassName = cn(
          "text-lg font-medium leading-tight text-white drop-shadow-sm",
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
          <div
            key={entry.id}
            className="relative min-h-0 overflow-hidden border-t border-white/20 bg-slate-800"
          >
            {entry.dishImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={entry.dishImageUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-700">
                <UtensilsCrossed className="size-10 text-white/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
            <div className="relative flex h-full items-end p-5">
              {titleNode}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyMeal({ day, inLink }: { day: Day; inLink?: boolean }) {
  const weekStart = getWeekStartIso(day.iso);
  return (
    <div className="text-slate-400 text-sm space-y-2">
      <UtensilsCrossed className="size-8 mx-auto opacity-30" />
      <div>Nothing planned</div>
      {!inLink && (
        <Link
          href={`/plan?week=${weekStart}`}
          className="text-emerald-600 hover:underline text-sm font-medium inline-block"
        >
          {day.isToday ? "Plan dinner →" : "Add a dish →"}
        </Link>
      )}
    </div>
  );
}

function getWeekStartIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
