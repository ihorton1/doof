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
  entry: {
    id: string;
    dishId: string | null;
    dishName: string | null;
    dishImageUrl: string | null;
    freeformText: string | null;
    status: string;
  } | null;
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
  const imageUrl = day.entry?.dishImageUrl ?? null;
  const hasImage = !!imageUrl;
  return (
    <div
      className={cn(
        "relative h-full rounded-2xl border overflow-hidden flex flex-col",
        hasImage ? "bg-slate-900" : "bg-white dark:bg-slate-900",
        emphasized
          ? "border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-sm"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      {hasImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />
        </>
      )}
      <div
        className={cn(
          "relative flex flex-col h-full p-5",
          hasImage && "text-white",
        )}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className={cn(
              "font-semibold",
              day.isToday && !hasImage
                ? "text-emerald-600 dark:text-emerald-400"
                : day.isToday && hasImage
                  ? "text-emerald-300"
                  : "",
            )}
          >
            {day.label}
          </h2>
          <span
            className={cn(
              "text-xs",
              hasImage ? "text-white/70" : "text-slate-400",
            )}
          >
            {day.iso}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          {day.entry ? (
            <PlannedMeal day={day} inLink={inLink} hasImage={hasImage} />
          ) : (
            <EmptyMeal day={day} inLink={inLink} />
          )}
        </div>
      </div>
    </div>
  );
}

function PlannedMeal({
  day,
  inLink,
  hasImage,
}: {
  day: Day;
  inLink?: boolean;
  hasImage?: boolean;
}) {
  const entry = day.entry!;
  const title = entry.dishName ?? entry.freeformText ?? "—";
  const titleNode =
    entry.dishId && !inLink ? (
      <Link href={`/dishes/${entry.dishId}`} className="hover:underline">
        {title}
      </Link>
    ) : (
      <span>{title}</span>
    );
  return (
    <div className="space-y-2 mt-auto">
      {!hasImage && (
        <UtensilsCrossed
          className={cn(
            "size-8 mx-auto",
            entry.status === "skipped" ? "text-slate-400" : "text-slate-500",
          )}
        />
      )}
      <div
        className={cn(
          "text-lg font-medium",
          entry.status === "skipped" && "line-through opacity-60",
        )}
      >
        {titleNode}
      </div>
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
