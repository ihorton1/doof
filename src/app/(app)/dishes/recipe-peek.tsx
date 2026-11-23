"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { z } from "zod";
import {
  PEEK_DRAFT_PREFIX, recipePeekInitial, recipePeekSchema,
  type PeekRecipe,
} from "@/lib/recipe-peek";

export function RecipePeek() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1 rounded-lg border border-emerald-600 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
      >
        <Eye className="size-4" aria-hidden />
        Peek
      </button>
      {open && <RecipePeekDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function RecipePeekDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<z.infer<typeof recipePeekSchema> | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const recipe = result?.recipes[selected];

  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    input.current?.focus();
    return () => { request.current?.abort(); el?.close(); };
  }, []);

  async function preview() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), mode: "peek" }),
        signal: controller.signal,
      });
      if (response.redirected || response.status === 401) {
        throw new Error("Your session has expired. Sign in again before previewing.");
      }
      const data: unknown = await response.json();
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(data);
        throw new Error(failure.success ? failure.data.error : "Could not preview this recipe. Try again or open the original site.");
      }
      const parsed = recipePeekSchema.safeParse(data);
      if (!parsed.success) throw new Error("The recipe preview returned an invalid response. Please try again.");
      if (!controller.signal.aborted) {
        setResult(parsed.data);
        setSelected(0);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        console.error("Could not preview recipe", cause);
        setError(cause instanceof Error ? cause.message : "Could not preview this recipe. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function addToDishes() {
    if (!result || !recipe || adding) return;
    setError("");
    try {
      const draft = { sourceUrl: result.sourceUrl, recipe };
      recipePeekInitial(draft);
      const id = crypto.randomUUID();
      sessionStorage.setItem(`${PEEK_DRAFT_PREFIX}${id}`, JSON.stringify(draft));
      setAdding(true);
      router.push(`/dishes/new?peek=${id}`);
      onClose();
    } catch (cause) {
      console.error("Could not open recipe draft", cause);
      setError("Could not open the add form. Allow session storage in your browser and try again, or use New to add it manually.");
    }
  }

  const originalUrl = (() => {
    const parsed = z.url().safeParse(url.trim());
    if (!parsed.success) return null;
    const source = new URL(parsed.data);
    return ["http:", "https:"].includes(source.protocol) && !source.username && !source.password ? source.href : null;
  })();

  return (
    <dialog
      ref={dialog}
      aria-labelledby="recipe-peek-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 flex h-[90dvh] max-h-[90dvh] w-full max-w-none flex-col rounded-t-[2rem] border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-black/50 open:flex not-open:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:inset-0 sm:m-auto sm:h-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-[2rem]"
    >
      <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recipe-peek-title" className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">Recipe preview</h2>
          <button type="button" onClick={onClose} aria-label="Close recipe preview" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" aria-hidden /></button>
        </div>
        <form
          onSubmit={(event) => { event.preventDefault(); void preview(); }}
          className="flex flex-wrap gap-2"
        >
          <label htmlFor="recipe-peek-url" className="sr-only">Recipe URL</label>
          <input
            ref={input}
            id="recipe-peek-url"
            type="url"
            required
            maxLength={500}
            value={url}
            onChange={(event) => {
              request.current?.abort();
              setBusy(false);
              setUrl(event.target.value);
              setResult(null);
              setError("");
            }}
            placeholder="Paste a recipe URL..."
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <button type="submit" disabled={busy || !url.trim()} className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? "Loading..." : "Preview"}</button>
        </form>
      </div>
      <div aria-busy={busy} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {busy && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Fetching recipe ingredients and method...</p>}
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        {!recipe && originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-300">Open original</a>}
        {result && recipe && (
          <>
            {result.recipes.length > 1 && (
              <label className="block text-sm font-medium">
                Recipe to preview
                <select
                  value={selected}
                  onChange={(event) => { setSelected(Number(event.target.value)); setError(""); }}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  {result.recipes.map((recipe, index) => <option key={index} value={index}>{recipe.name || `Recipe ${index + 1}`}</option>)}
                </select>
              </label>
            )}
            <div className="space-y-2">
              <h3 className="break-words text-2xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">{recipe.name || "Untitled recipe"}</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-700 underline dark:text-emerald-300">{new URL(result.sourceUrl).hostname} · Open original</a>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">Not saved</span>
              </div>
            </div>
            {result.warnings.map((warning, index) => <p key={index} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>)}
            <RecipePeekContents recipe={recipe} />
          </>
        )}
      </div>
      {recipe && (
        <div className="shrink-0 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800 sm:p-6">
          <button type="button" disabled={adding} onClick={addToDishes} className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Add to my dishes &rarr;</button>
        </div>
      )}
    </dialog>
  );
}

export function RecipePeekContents({ recipe }: { recipe: PeekRecipe }) {
  return (
    <>
      <section aria-labelledby="peek-ingredients" className="space-y-3">
        <h4 id="peek-ingredients" className="text-lg font-bold">Ingredients</h4>
        {recipe.ingredients.length
          ? <ul className="list-disc space-y-2 pl-5">{recipe.ingredients.map((line, index) => <li key={index} className="break-words">{line}</li>)}</ul>
          : <p className="text-sm text-amber-700 dark:text-amber-400">Ingredients could not be extracted. Check the original recipe.</p>}
      </section>
      <section aria-labelledby="peek-method" className="space-y-3">
        <h4 id="peek-method" className="text-lg font-bold">Method</h4>
        {recipe.instructions.length ? (
          <ol className="space-y-4">
            {recipe.instructions.map((step, index) => (
              <li key={index} className="space-y-2">
                {step.section && step.section !== recipe.instructions[index - 1]?.section && <h5 className="font-semibold">{step.section}</h5>}
                <p className="break-words"><span className="mr-2 font-semibold text-emerald-700 dark:text-emerald-300">{index + 1}.</span>{step.text}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-amber-700 dark:text-amber-400">The method could not be extracted. Read it on the original site; no steps have been invented.</p>}
      </section>
    </>
  );
}
