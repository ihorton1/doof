"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Refrigerator, UtensilsCrossed } from "lucide-react";
import { cn, fromISODate } from "@/lib/utils";
import { isLeftoverSwipe, LEFTOVER_DAYS, type DismissLeftoversAction, type Leftover } from "@/lib/leftovers";

const freshnessColors = [
  "bg-emerald-500",
  "bg-yellow-400",
  "bg-orange-500",
  "bg-red-500",
];

export function LeftoversView({
  leftovers,
  dismissAction,
  refreshAt,
}: {
  leftovers: Leftover[];
  dismissAction: DismissLeftoversAction;
  refreshAt: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const visible = leftovers.filter((leftover) => !dismissed.has(leftover.entryId));

  useEffect(() => {
    const refresh = () => {
      if (Date.now() >= refreshAt) router.refresh();
    };
    const timer = window.setTimeout(refresh, Math.max(0, refreshAt - Date.now()));
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshAt, router]);

  return (
    <section aria-labelledby="leftovers-heading" className="shrink-0 space-y-4 pb-4 pt-6">
      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        <Refrigerator className="size-6" aria-hidden />
        <h2 id="leftovers-heading" className="text-2xl font-extrabold tracking-tight">Leftovers</h2>
      </div>
      <p role="status" className="sr-only">{message}</p>
      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((leftover) => (
            <LeftoverRow
              key={leftover.entryId}
              leftover={leftover}
              dismissAction={dismissAction}
              onDismissed={() => {
                setDismissed((previous) => new Set(previous).add(leftover.entryId));
                setMessage(`${leftover.name} leftovers cleared.`);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No leftovers to keep track of. Past recipes stay here until cleared or more than ten days old.
        </p>
      )}
    </section>
  );
}

function LeftoverRow({
  leftover,
  dismissAction,
  onDismissed,
}: {
  leftover: Leftover;
  dismissAction: DismissLeftoversAction;
  onDismissed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number; horizontal: boolean } | null>(null);
  const dragged = useRef(false);
  const saving = useRef(false);

  function dismiss() {
    if (saving.current) return;
    saving.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await dismissAction({ entryId: leftover.entryId });
        if ("error" in result) setError(result.error);
        else {
          onDismissed();
        }
      } catch (error) {
        console.error("Failed to clear leftovers", error);
        setError("Could not clear these leftovers. Check your connection and try again.");
      } finally {
        saving.current = false;
      }
    });
  }

  const expired = leftover.daysRemaining === 0;
  const remainingLabel = expired ? "Expired" : leftover.daysRemaining === 1 ? "Last day" : `${leftover.daysRemaining} days left`;

  return (
    <li className="overflow-hidden rounded-2xl bg-emerald-100 dark:bg-emerald-950">
      <div
        className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 touch-pan-y rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          dragged.current = false;
          if (!event.isPrimary || event.button !== 0 || pending ||
            (event.target instanceof Element && event.target.closest("button"))) return;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.horizontal) {
            if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
              gesture.current = null;
              return;
            }
            if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
            start.horizontal = true;
            dragged.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          setOffset(Math.max(-160, Math.min(160, dx)));
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          gesture.current = null;
          setOffset(0);
          if (start?.id === event.pointerId && start.horizontal &&
            isLeftoverSwipe(event.clientX - start.x, event.clientY - start.y)) dismiss();
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setOffset(0);
        }}
        onLostPointerCapture={(event) => {
          if (event.target !== event.currentTarget) return;
          gesture.current = null;
          setOffset(0);
        }}
        onClickCapture={(event) => {
          if (dragged.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <div aria-hidden className="row-span-3 flex size-14 self-center items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {leftover.dishImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={leftover.dishImageUrl}
              alt=""
              width={56}
              height={56}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <UtensilsCrossed className="size-6 text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-bold text-emerald-800 dark:text-emerald-300">
              <Link href={`/dishes/${leftover.dishId}`} className="hover:underline">{leftover.name}</Link>
            </h3>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={dismiss}
            aria-label={`Mark ${leftover.name} leftovers as eaten`}
            className="-my-2 flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            <Check className="size-4" aria-hidden />
            {pending ? "Clearing..." : "Eaten"}
          </button>
        </div>
        {expired ? (
          <span role="img" aria-label={`${leftover.name}: expired leftovers`} className="text-2xl leading-none">
            {"\u{1F92E}"}
          </span>
        ) : (
          <div
            role="progressbar"
            aria-label={`${leftover.name}: ${remainingLabel}`}
            aria-valuemin={0}
            aria-valuemax={LEFTOVER_DAYS}
            aria-valuenow={leftover.daysRemaining}
            aria-valuetext={`Day ${leftover.day} of ${LEFTOVER_DAYS}; ${remainingLabel.toLowerCase()}`}
            className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div
              className={cn("h-full rounded-full", freshnessColors[leftover.day - 1])}
              style={{ width: `${leftover.daysRemaining / LEFTOVER_DAYS * 100}%` }}
            />
            <div className="absolute inset-0 grid grid-cols-4" aria-hidden>
              {[1, 2, 3].map((day) => <span key={day} className="border-r-2 border-white/70 dark:border-slate-900/70" />)}
            </div>
          </div>
        )}
        <div className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            <time dateTime={leftover.plannedDate}>{fromISODate(leftover.plannedDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</time>
          </span>
          <span className="font-semibold">{remainingLabel}</span>
        </div>
        {error && <p role="alert" className="col-span-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </li>
  );
}
