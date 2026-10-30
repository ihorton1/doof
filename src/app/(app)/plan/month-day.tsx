"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

type Recipe = { id: string; name: string; imageUrl: string | null };

export function MonthDay({
  iso, recipes, className, children,
}: {
  iso: string;
  recipes: Recipe[];
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uniqueRecipes = recipes.filter((recipe, index) =>
    recipes.findIndex((other) => other.id === recipe.id) === index,
  );

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  if (uniqueRecipes.length === 0) return <div className={className}>{children}</div>;
  if (uniqueRecipes.length === 1) {
    return (
      <Link
        href={`/dishes/${uniqueRecipes[0].id}`}
        aria-label={`View ${uniqueRecipes[0].name} on ${iso}`}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={`Choose a dish for ${iso}`}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby={`month-dishes-${iso}`}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialogRef.current?.close();
          }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] rounded-2xl bg-white p-4 text-slate-900 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id={`month-dishes-${iso}`} className="font-semibold">Dishes for {iso}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close dish chooser"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {uniqueRecipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/dishes/${recipe.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {recipe.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={recipe.imageUrl} alt="" className="size-12 shrink-0 rounded object-cover" />
                  )}
                  <span>{recipe.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </dialog>
      )}
    </>
  );
}
