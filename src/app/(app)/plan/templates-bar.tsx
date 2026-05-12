"use client";

import { useState, useTransition } from "react";
import { Bookmark, Trash2, X } from "lucide-react";
import { saveTemplate, applyTemplate, deleteTemplate } from "./template-actions";

export type TemplateSummary = {
  id: string;
  name: string;
  entryCount: number;
  miscCount: number;
  createdAt: string;
};

export function TemplatesBar({
  weekStart,
  templates,
  hasEntries,
}: {
  weekStart: string;
  templates: TemplateSummary[];
  hasEntries: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Bookmark className="size-3.5" />
          Saved plans
        </button>
      </div>
      {open && (
        <TemplatesModal
          weekStart={weekStart}
          templates={templates}
          hasEntries={hasEntries}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TemplatesModal({
  weekStart,
  templates,
  hasEntries,
  onClose,
}: {
  weekStart: string;
  templates: TemplateSummary[];
  hasEntries: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await saveTemplate({ weekStart, name: trimmed });
      setName("");
    });
  }

  function apply(id: string, displayName: string) {
    if (
      hasEntries &&
      !confirm(
        `Apply "${displayName}" to this week? This will REPLACE the current meal plan and Misc items for the week.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await applyTemplate({ templateId: id, weekStart });
      onClose();
    });
  }

  function remove(id: string, displayName: string) {
    if (!confirm(`Delete saved plan "${displayName}"?`)) return;
    startTransition(async () => {
      await deleteTemplate(id);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Saved plans</h2>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save current week as…"
            maxLength={120}
            className="flex-1 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Save
          </button>
        </form>

        <div className="flex-1 overflow-y-auto -mx-4 px-4 border-y border-slate-200 dark:border-slate-800 py-2 space-y-1">
          {templates.length === 0 && (
            <p className="text-sm text-slate-400 px-2 py-3">
              No saved plans yet. Save the current week to reuse it later.
            </p>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-slate-500">
                  {t.entryCount} meal{t.entryCount === 1 ? "" : "s"}
                  {t.miscCount > 0 && ` · ${t.miscCount} misc`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => apply(t.id, t.name)}
                disabled={isPending}
                className="h-8 px-3 rounded text-xs font-medium bg-emerald-600 text-white disabled:opacity-50"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => remove(t.id, t.name)}
                disabled={isPending}
                className="size-8 flex items-center justify-center rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-50"
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          Apply replaces the current week's plan and Misc items with the saved one.
        </p>
      </div>
    </div>
  );
}
