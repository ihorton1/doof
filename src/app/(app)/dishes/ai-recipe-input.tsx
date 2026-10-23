"use client";

import { useRef, useState } from "react";
import { Copy } from "lucide-react";
import {
  AI_RECIPE_PROMPT,
  AiRecipeError,
  MAX_AI_RECIPE_LENGTH,
  parseAiRecipe,
} from "@/lib/ai-recipe";
import type { ImportedRecipe } from "@/lib/recipe-import";

export function AiRecipeInput({
  onPreview,
  onChange,
}: {
  onPreview: (recipe: ImportedRecipe & { notes: string }) => void;
  onChange: () => void;
}) {
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_RECIPE_PROMPT);
      setCopyMessage("Prompt copied.");
    } catch {
      const prompt = promptRef.current;
      if (prompt) {
        prompt.focus();
        prompt.select();
        setCopyMessage("Clipboard access is unavailable. The prompt is selected so you can copy it manually.");
      } else {
        setCopyMessage("Clipboard access is unavailable. Select and copy the prompt manually.");
      }
    }
  }

  function preview(value: string) {
    setResponse(value);
    setError(null);
    onChange();
    if (!value.trim()) return;
    try {
      onPreview(parseAiRecipe(value));
    } catch (error) {
      if (!(error instanceof AiRecipeError)) {
        console.error("AI recipe preview failed:", error instanceof Error ? error.name : "Unknown error");
      }
      setError(error instanceof AiRecipeError ? error.message : "Could not preview this recipe. Please try again.");
    }
  }

  return (
    <div id="ai-recipe-input" className="space-y-3">
      <label htmlFor="ai-recipe-prompt" className="block text-sm font-medium">
        Formatting prompt
      </label>
      <div className="relative">
        <textarea
          id="ai-recipe-prompt"
          ref={promptRef}
          readOnly
          value={AI_RECIPE_PROMPT}
          rows={7}
          className={`${textareaCls} pr-12 resize-none overflow-y-auto no-scrollbar`}
        />
        <button
          type="button"
          onClick={copyPrompt}
          aria-label="Copy formatting prompt"
          title="Copy formatting prompt"
          className="absolute top-1 right-1 size-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-slate-500 hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p role="status" className="text-xs text-slate-500">{copyMessage}</p>
      <label className="block text-sm font-medium">
        Chatbot response
        <textarea
          value={response}
          rows={8}
          maxLength={MAX_AI_RECIPE_LENGTH + 1}
          placeholder="Paste the formatted recipe JSON here"
          onChange={(event) => preview(event.target.value)}
          className={textareaCls}
        />
      </label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

const textareaCls =
  "block w-full mt-1 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500";
