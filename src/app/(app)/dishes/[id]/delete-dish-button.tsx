"use client";

import { Trash2 } from "lucide-react";

export function DeleteDishButton({
  action,
  name,
}: {
  action: () => void | Promise<void>;
  name: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
        aria-label="Delete dish"
        onClick={(e) => {
          if (!confirm(`Delete "${name}"?`)) e.preventDefault();
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  );
}
