import Link from "next/link";

export function ViewToggle({
  current,
  monthParam,
}: {
  current: "day" | "month";
  monthParam: string;
}) {
  const base =
    "inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md";
  const active = "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white";
  const inactive = "text-slate-600 dark:text-slate-300";
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      <Link
        href="/meals"
        aria-current={current === "day" ? "page" : undefined}
        className={`${base} ${current === "day" ? active : inactive}`}
      >
        Day
      </Link>
      <Link
        href={`/meals?view=month&month=${monthParam}`}
        aria-current={current === "month" ? "page" : undefined}
        className={`${base} ${current === "month" ? active : inactive}`}
      >
        Month
      </Link>
    </div>
  );
}
