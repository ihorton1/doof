"use client";

import { useEffect, useLayoutEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { setEntryStatus } from "../plan/actions";
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
    freeformText: string | null;
    status: string;
  } | null;
};

export function TodayView({
  days,
  focusIso,
  realTodayIso,
  prevFocusIso,
  nextFocusIso,
}: {
  days: Day[];
  focusIso: string;
  realTodayIso: string;
  prevFocusIso: string;
  nextFocusIso: string;
}) {
  const isFocusToday = focusIso === realTodayIso;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tonight</h1>
        {!isFocusToday && (
          <Link
            href="/today"
            className="text-sm text-emerald-600 hover:underline"
          >
            Jump to today
          </Link>
        )}
      </div>

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
        "h-full rounded-2xl border bg-white dark:bg-slate-900 p-5 flex flex-col",
        emphasized
          ? "border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-sm"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className={cn(
            "font-semibold",
            day.isToday ? "text-emerald-600 dark:text-emerald-400" : "",
          )}
        >
          {day.label}
        </h2>
        <span className="text-xs text-slate-400">{day.iso}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
        {day.entry ? (
          <PlannedMeal day={day} inLink={inLink} />
        ) : (
          <EmptyMeal isToday={day.isToday} inLink={inLink} />
        )}
      </div>

      {day.isToday && day.entry && !inLink && <TodayActions entry={day.entry} />}
    </div>
  );
}

function PlannedMeal({ day, inLink }: { day: Day; inLink?: boolean }) {
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
    <div className="space-y-2">
      <UtensilsCrossed
        className={cn(
          "size-8 mx-auto",
          entry.status === "cooked"
            ? "text-emerald-500"
            : entry.status === "skipped"
              ? "text-slate-400"
              : "text-slate-500",
        )}
      />
      <div
        className={cn(
          "text-lg font-medium",
          entry.status === "skipped" && "line-through text-slate-400",
        )}
      >
        {titleNode}
      </div>
      <StatusBadge status={entry.status} />
    </div>
  );
}

function EmptyMeal({ isToday, inLink }: { isToday: boolean; inLink?: boolean }) {
  return (
    <div className="text-slate-400 text-sm space-y-2">
      <UtensilsCrossed className="size-8 mx-auto opacity-30" />
      <div>Nothing planned</div>
      {isToday && !inLink && (
        <Link
          href="/plan"
          className="text-emerald-600 hover:underline text-sm font-medium inline-block"
        >
          Plan dinner →
        </Link>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    planned: {
      label: "Planned",
      cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    cooked: {
      label: "Cooked",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    skipped: {
      label: "Skipped",
      cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    },
  };
  const m = map[status] ?? map.planned;
  return (
    <span className={cn("inline-block text-xs px-2 py-0.5 rounded-full", m.cls)}>
      {m.label}
    </span>
  );
}

function TodayActions({ entry }: { entry: NonNullable<Day["entry"]> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  function set(next: "planned" | "cooked" | "skipped") {
    startTransition(async () => {
      await setEntryStatus({ entryId: entry.id, status: next });
      router.refresh();
    });
  }
  return (
    <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => set(entry.status === "cooked" ? "planned" : "cooked")}
        disabled={isPending}
        className={cn(
          "flex-1 h-11 rounded-lg font-medium text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50",
          entry.status === "cooked"
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <Check className="size-4" />
        {entry.status === "cooked" ? "Cooked" : "Mark cooked"}
      </button>
      <button
        type="button"
        onClick={() => set(entry.status === "skipped" ? "planned" : "skipped")}
        disabled={isPending}
        aria-label={entry.status === "skipped" ? "Unskip" : "Skip"}
        className={cn(
          "h-11 w-11 rounded-lg inline-flex items-center justify-center disabled:opacity-50",
          entry.status === "skipped"
            ? "bg-slate-500 text-white hover:bg-slate-600"
            : "border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
