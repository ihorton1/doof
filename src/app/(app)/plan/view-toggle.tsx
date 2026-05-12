import Link from "next/link";

export function ViewToggle({
  current,
  weekParam,
  monthParam,
}: {
  current: "week" | "month";
  weekParam: string;
  monthParam: string;
}) {
  const base =
    "inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md";
  const active = "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white";
  const inactive = "text-slate-600 dark:text-slate-300";
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      <Link
        href={`/plan?view=week&week=${weekParam}`}
        className={`${base} ${current === "week" ? active : inactive}`}
      >
        Week
      </Link>
      <Link
        href={`/plan?view=month&month=${monthParam}`}
        className={`${base} ${current === "month" ? active : inactive}`}
      >
        Month
      </Link>
    </div>
  );
}
